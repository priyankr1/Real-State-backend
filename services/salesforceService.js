import logger from '../utils/logger.js';
import { getAccessToken, resetTokenCache } from './salesforceAuth.js';
import { createEnquiry, validateCampaignCodeMap } from './salesforceEnquiryApi.js';

/**
 * Salesforce lead delivery.
 *
 * Three transports, chosen by what is configured:
 *
 *   enquiry-api  — Merlin's own Apex service, POST to
 *                  /services/apexrest/Merlin/InsertNewEnquiry/. This is the
 *                  integration Merlin's SFDC team documented and the one their
 *                  org is actually wired for: it creates an Enquiry, not a
 *                  Lead, and derives project, source and sub-source from the
 *                  campaign code. Default whenever credentials exist.
 *   rest         — the stock Lead object, POST sObjects/Lead. Kept for orgs
 *                  without the Apex service; select it with SALESFORCE_MODE.
 *   web-to-lead  — form POST to webto.salesforce.com. Needs no credentials,
 *                  which is why clients like it, but it answers 200 to
 *                  everything including rejected leads, so a lead lost to a
 *                  validation rule cannot be detected here.
 *
 * With none configured every call returns { skipped: true } and the enquiry
 * still saves. Lead capture must never depend on a third party being up — the
 * enquiry is in MongoDB before this module is ever called.
 */

const API_VERSION = process.env.SALESFORCE_API_VERSION || 'v60.0';

const MODES = new Set(['enquiry-api', 'rest', 'web-to-lead', 'off']);

export function salesforceMode() {
  const explicit = (process.env.SALESFORCE_MODE || '').trim().toLowerCase();
  if (MODES.has(explicit)) return explicit;

  // Credentials imply the Apex service rather than the Lead object: that is
  // what Merlin's integration document specifies, and picking `rest` here
  // would quietly write into a different object than the one their sales team
  // works from.
  if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET) {
    return 'enquiry-api';
  }
  if (process.env.SALESFORCE_ORG_ID) return 'web-to-lead';
  return 'off';
}

export function isSalesforceConfigured() {
  return salesforceMode() !== 'off';
}

/**
 * Configuration problems worth saying out loud at boot rather than discovering
 * one failed enquiry at a time.
 */
export function salesforceConfigWarnings() {
  const mode = salesforceMode();
  if (mode === 'off') return [];

  const warnings = [];
  const mapError = validateCampaignCodeMap();
  if (mapError) warnings.push(mapError);

  if (mode === 'enquiry-api' || mode === 'rest') {
    if (!process.env.SALESFORCE_CLIENT_ID || !process.env.SALESFORCE_CLIENT_SECRET) {
      warnings.push(`SALESFORCE_MODE=${mode} needs SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET`);
    }
  }

  if (mode === 'enquiry-api' && !process.env.SALESFORCE_DEFAULT_CAMPAIGN_CODE) {
    // Campaign_Code is mandatory on the endpoint. Without a default, every
    // enquiry that arrives without a mapped UTM is rejected outright.
    warnings.push(
      'SALESFORCE_DEFAULT_CAMPAIGN_CODE is unset — enquiries with no mapped campaign will be rejected'
    );
  }

  if (mode === 'web-to-lead' && !process.env.SALESFORCE_ORG_ID) {
    warnings.push('SALESFORCE_MODE=web-to-lead needs SALESFORCE_ORG_ID');
  }

  return warnings;
}

// ── Field mapping (Lead object transports only) ─────────────────────────────

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
    resetTokenCache();
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

const TRANSPORTS = {
  'enquiry-api': createEnquiry,
  rest: createLeadViaRest,
  'web-to-lead': createLeadViaWebToLead,
};

/**
 * Pushes one enquiry to Salesforce.
 *
 * Never throws — returns a result object the caller records on the enquiry.
 * `permanent` on a failure means the same payload will be rejected the same
 * way forever (a missing mandatory field, a 404 on the Apex path); the retry
 * sweep uses it to stop replaying work that cannot succeed.
 */
export async function sendLead(enquiry) {
  const mode = salesforceMode();
  if (mode === 'off') {
    return { ok: false, skipped: true, reason: 'Salesforce not configured' };
  }

  const transport = TRANSPORTS[mode];
  if (!transport) {
    return { ok: false, skipped: true, reason: `Unknown SALESFORCE_MODE "${mode}"` };
  }

  try {
    const result = await transport(enquiry);

    logger.info('Salesforce enquiry delivered', {
      enquiryId: String(enquiry._id || ''),
      leadId: result.leadId || '(no id returned)',
      campaignCode: result.campaignCode || '',
      mode: result.mode,
    });
    return { ok: true, ...result };
  } catch (error) {
    logger.error('Salesforce delivery failed', {
      enquiryId: String(enquiry._id || ''),
      mode,
      permanent: Boolean(error.permanent),
      error: error.message,
    });
    return {
      ok: false,
      skipped: false,
      error: error.message,
      permanent: Boolean(error.permanent),
      mode,
    };
  }
}

export default {
  sendLead,
  isSalesforceConfigured,
  salesforceMode,
  salesforceConfigWarnings,
};
