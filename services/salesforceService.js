import logger from '../utils/logger.js';

/**
 * Salesforce lead delivery.
 *
 * Two transports, chosen by what is configured:
 *
 *   rest         — OAuth 2.0 against a connected app, then POST sObjects/Lead.
 *                  Returns a real Lead Id and real errors, so a failed lead is
 *                  knowable and retryable. Preferred.
 *   web-to-lead  — form POST to webto.salesforce.com. Needs no credentials,
 *                  which is why clients like it, but it answers 200 to
 *                  everything including rejected leads. Use only if Merlin
 *                  cannot provide a connected app.
 *
 * With neither configured every call returns { skipped: true } and the enquiry
 * still saves. Lead capture must never depend on a third party being up — the
 * enquiry is in MongoDB before this module is ever called.
 */

const API_VERSION = process.env.SALESFORCE_API_VERSION || 'v60.0';

/** Cached OAuth token. Salesforce tokens are long-lived; re-auth per lead is waste. */
let tokenCache = { accessToken: null, instanceUrl: null, expiresAt: 0 };

export function salesforceMode() {
  const explicit = (process.env.SALESFORCE_MODE || '').trim().toLowerCase();
  if (explicit === 'rest' || explicit === 'web-to-lead' || explicit === 'off') return explicit;

  if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET) return 'rest';
  if (process.env.SALESFORCE_ORG_ID) return 'web-to-lead';
  return 'off';
}

export function isSalesforceConfigured() {
  return salesforceMode() !== 'off';
}

// ── OAuth ───────────────────────────────────────────────────────────────────

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache;
  }

  const loginUrl = (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(
    /\/+$/,
    ''
  );

  const body = new URLSearchParams();
  body.set('client_id', process.env.SALESFORCE_CLIENT_ID || '');
  body.set('client_secret', process.env.SALESFORCE_CLIENT_SECRET || '');

  // Client credentials is the right flow for server-to-server lead creation:
  // no user, no refresh token to leak. The username/password flow is only a
  // fallback for orgs that have not enabled a client-credentials run-as user.
  if (process.env.SALESFORCE_USERNAME && process.env.SALESFORCE_PASSWORD) {
    body.set('grant_type', 'password');
    body.set('username', process.env.SALESFORCE_USERNAME);
    body.set(
      'password',
      `${process.env.SALESFORCE_PASSWORD}${process.env.SALESFORCE_SECURITY_TOKEN || ''}`
    );
  } else {
    body.set('grant_type', 'client_credentials');
  }

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    // Never log the body verbatim at error level — it can echo credentials.
    throw new Error(`Salesforce auth failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = JSON.parse(text);
  tokenCache = {
    accessToken: data.access_token,
    instanceUrl: (data.instance_url || process.env.SALESFORCE_INSTANCE_URL || '').replace(
      /\/+$/,
      ''
    ),
    // Salesforce does not return expires_in for these flows. 90 minutes is
    // comfortably inside the default 2-hour session timeout, and a 401 below
    // clears the cache anyway.
    expiresAt: Date.now() + 90 * 60 * 1000,
  };

  if (!tokenCache.instanceUrl) {
    throw new Error('Salesforce auth returned no instance_url and SALESFORCE_INSTANCE_URL is unset');
  }

  return tokenCache;
}

// ── Field mapping ───────────────────────────────────────────────────────────

/**
 * Salesforce Lead requires LastName and Company. Indian enquiry forms collect
 * one name field and no company, so both are derived rather than demanded of
 * the visitor — an extra required field costs more leads than it gains data.
 */
function splitName(full = '') {
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: 'Unknown' };
  if (parts.length === 1) return { first: '', last: parts[0] };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** Which touch drives the standard Salesforce campaign fields. */
function primaryTouch(enquiry) {
  const model = (process.env.SALESFORCE_ATTRIBUTION_MODEL || 'first').toLowerCase();
  const first = enquiry.firstTouch || {};
  const last = enquiry.lastTouch || {};
  if (model === 'last') return { primary: last, secondary: first, label: 'First touch' };
  return { primary: first, secondary: last, label: 'Last touch' };
}

const touchLines = (label, t = {}) =>
  [
    `${label}:`,
    `  Source: ${t.source || '—'}`,
    `  Medium: ${t.medium || '—'}`,
    `  Campaign: ${t.campaign || '—'}`,
    `  Term: ${t.term || '—'}`,
    `  Content: ${t.content || '—'}`,
    t.id ? `  Campaign ID: ${t.id}` : null,
    t.gclid ? `  GCLID: ${t.gclid}` : null,
    t.fbclid ? `  FBCLID: ${t.fbclid}` : null,
    t.msclkid ? `  MSCLKID: ${t.msclkid}` : null,
    `  Referrer: ${t.referrer || 'direct'}`,
    `  Landing page: ${t.landingPage || '—'}`,
  ]
    .filter(Boolean)
    .join('\n');

/**
 * Everything that has no standard Lead field goes into the description, so no
 * attribution is lost even in an org with zero custom fields configured.
 * Custom fields (SALESFORCE_FIELD_*) override this when Merlin creates them.
 */
function buildDescription(enquiry) {
  const { primary, secondary, label } = primaryTouch(enquiry);
  return [
    enquiry.message || '(no message)',
    '',
    `Form: ${enquiry.formType}`,
    `Page: ${enquiry.pagePath || '—'}`,
    enquiry.interest ? `Interest: ${enquiry.interest}` : null,
    enquiry.displayedPhone ? `Number shown to visitor: ${enquiry.displayedPhone}` : null,
    '',
    touchLines('Attribution (primary)', primary),
    '',
    touchLines(label, secondary),
    '',
    `Consent given: ${enquiry.consent ? 'yes' : 'no'}`,
    `Submitted: ${new Date(enquiry.createdAt || Date.now()).toISOString()}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/**
 * Optional custom-field mapping. Merlin's Salesforce admin sets, for example,
 * SALESFORCE_FIELD_UTM_SOURCE=UTM_Source__c and the value lands in that field.
 * Unset variables are simply not sent, so this works against a stock org.
 */
function customFields(enquiry) {
  const { primary } = primaryTouch(enquiry);
  const map = {
    SALESFORCE_FIELD_UTM_SOURCE: primary.source,
    SALESFORCE_FIELD_UTM_MEDIUM: primary.medium,
    SALESFORCE_FIELD_UTM_CAMPAIGN: primary.campaign,
    SALESFORCE_FIELD_UTM_TERM: primary.term,
    SALESFORCE_FIELD_UTM_CONTENT: primary.content,
    SALESFORCE_FIELD_GCLID: primary.gclid,
    SALESFORCE_FIELD_LANDING_PAGE: primary.landingPage,
    SALESFORCE_FIELD_REFERRER: primary.referrer,
    SALESFORCE_FIELD_FORM_TYPE: enquiry.formType,
    SALESFORCE_FIELD_PAGE_PATH: enquiry.pagePath,
    SALESFORCE_FIELD_DISPLAYED_PHONE: enquiry.displayedPhone,
    SALESFORCE_FIELD_INTEREST: enquiry.interest,
  };

  const out = {};
  for (const [envKey, value] of Object.entries(map)) {
    const apiName = process.env[envKey];
    if (apiName && value) out[apiName] = String(value).slice(0, 255);
  }
  return out;
}

function buildLeadPayload(enquiry) {
  const { first, last } = splitName(enquiry.name);
  const { primary } = primaryTouch(enquiry);

  return {
    FirstName: first || undefined,
    LastName: last,
    // Company is required on Lead. Nothing on a residential enquiry form maps
    // to it, so it is stamped with a constant the sales team can filter on.
    Company: process.env.SALESFORCE_DEFAULT_COMPANY || 'Website Enquiry',
    Email: enquiry.email,
    Phone: enquiry.phone || undefined,
    LeadSource: primary.source || process.env.SALESFORCE_DEFAULT_LEAD_SOURCE || 'Website',
    Description: buildDescription(enquiry),
    ...(process.env.SALESFORCE_LEAD_RECORD_TYPE_ID
      ? { RecordTypeId: process.env.SALESFORCE_LEAD_RECORD_TYPE_ID }
      : {}),
    ...(process.env.SALESFORCE_LEAD_OWNER_ID
      ? { OwnerId: process.env.SALESFORCE_LEAD_OWNER_ID }
      : {}),
    ...customFields(enquiry),
  };
}

// ── Transports ──────────────────────────────────────────────────────────────

async function createLeadViaRest(enquiry) {
  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}/services/data/${API_VERSION}/sobjects/Lead`;

  const send = (token) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildLeadPayload(enquiry)),
      signal: AbortSignal.timeout(15000),
    });

  let response = await send(accessToken);

  // A cached token can outlive the session (admin revoke, password reset).
  // One forced re-auth turns a permanent failure into a transient one.
  if (response.status === 401) {
    tokenCache = { accessToken: null, instanceUrl: null, expiresAt: 0 };
    const fresh = await getAccessToken();
    response = await send(fresh.accessToken);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Salesforce Lead create failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const data = JSON.parse(text);
  return { leadId: data.id || '', mode: 'rest' };
}

async function createLeadViaWebToLead(enquiry) {
  const { first, last } = splitName(enquiry.name);
  const { primary } = primaryTouch(enquiry);

  const endpoint =
    process.env.SALESFORCE_WEB_TO_LEAD_URL ||
    'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8';

  const body = new URLSearchParams();
  body.set('oid', process.env.SALESFORCE_ORG_ID || '');
  body.set('retURL', process.env.SALESFORCE_RETURN_URL || 'https://merlinprojects.com');
  if (first) body.set('first_name', first);
  body.set('last_name', last);
  body.set('company', process.env.SALESFORCE_DEFAULT_COMPANY || 'Website Enquiry');
  body.set('email', enquiry.email);
  if (enquiry.phone) body.set('phone', enquiry.phone);
  body.set('lead_source', primary.source || process.env.SALESFORCE_DEFAULT_LEAD_SOURCE || 'Website');
  body.set('description', buildDescription(enquiry));
  for (const [apiName, value] of Object.entries(customFields(enquiry))) {
    body.set(apiName, value);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Web-to-Lead POST failed (${response.status})`);
  }

  // Web-to-Lead returns 200 whether or not the lead was accepted, so there is
  // no id to record and no way to detect a validation-rule rejection here.
  // This is the transport's limitation, not an oversight — it is why `rest`
  // is preferred and why this returns an empty leadId.
  return { leadId: '', mode: 'web-to-lead' };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Pushes one enquiry to Salesforce.
 * Never throws — returns a result object the caller records on the enquiry.
 */
export async function sendLead(enquiry) {
  const mode = salesforceMode();
  if (mode === 'off') {
    return { ok: false, skipped: true, reason: 'Salesforce not configured' };
  }

  try {
    const result =
      mode === 'web-to-lead' ? await createLeadViaWebToLead(enquiry) : await createLeadViaRest(enquiry);

    logger.info('Salesforce lead created', {
      enquiryId: String(enquiry._id || ''),
      leadId: result.leadId || '(web-to-lead)',
      mode: result.mode,
    });
    return { ok: true, ...result };
  } catch (error) {
    logger.error('Salesforce lead failed', {
      enquiryId: String(enquiry._id || ''),
      error: error.message,
    });
    return { ok: false, skipped: false, error: error.message, mode };
  }
}

export default { sendLead, isSalesforceConfigured, salesforceMode };
