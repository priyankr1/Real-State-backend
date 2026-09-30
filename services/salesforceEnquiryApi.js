import { getAccessToken, resetTokenCache } from './salesforceAuth.js';

/**
 * Merlin's "Web to Enquiry" Apex REST endpoint.
 *
 *   POST {instance_url}/services/apexrest/Merlin/InsertNewEnquiry/
 *
 * This is a custom Apex service, not the standard Lead object, and it differs
 * from a normal REST call in two ways that drive the whole module:
 *
 *   1. It answers HTTP 200 with a body of {status, message, id}. `status: 200`
 *      is success; `status: 1` is a rejection. Reading only the HTTP status
 *      would record every rejected enquiry as delivered.
 *   2. Name, Mobile and Campaign_Code are mandatory. A missing one is a
 *      rejection that will be rejected identically forever, so it is reported
 *      as permanent and never queued for retry.
 *
 * Project, Source and Sub-source are derived inside Salesforce from the
 * campaign code, which is why Campaign_Code carries so much weight here.
 */

const DEFAULT_PATH = '/services/apexrest/Merlin/InsertNewEnquiry/';

/** Salesforce is an Indian org; its date fields are read as local wall-clock time. */
const TIMEZONE = process.env.SALESFORCE_TIMEZONE || 'Asia/Kolkata';

// ── Small formatters ────────────────────────────────────────────────────────

const trim = (value, max = 255) => String(value ?? '').trim().slice(0, max);

/**
 * "2022-11-09 18:00:00" in the org's timezone, which is the format the
 * endpoint's samples use. An ISO string with a Z would be read as local time
 * by Apex and silently land five and a half hours out.
 */
function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});

  // Some ICU builds render midnight as hour 24 under hour12:false.
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/**
 * Splits a submitted phone number into a dial code and a national number,
 * because the endpoint takes them as two fields.
 *
 * Deliberately not a full phone-number library: the site's forms are Indian
 * and the overwhelming majority of entries are a bare ten-digit number. Codes
 * are matched longest-first against a configured list so "+1" cannot shadow a
 * longer code that begins with the same digit.
 */
function splitPhone(raw) {
  const fallbackCode = process.env.SALESFORCE_DEFAULT_COUNTRY_CODE || '+91';
  const codes = (
    process.env.SALESFORCE_DIAL_CODES || '+91,+971,+974,+973,+968,+966,+65,+61,+66,+44,+1'
  )
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return { code: fallbackCode, number: '' };

  // 00 is the other way of writing a leading +.
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;

  if (digits.startsWith('+')) {
    const match = codes.find((code) => digits.startsWith(code));
    if (match) return { code: match, number: digits.slice(match.length) };
    // An unlisted country: keep the whole thing in the number field rather
    // than guessing a split and corrupting both halves.
    return { code: '', number: digits };
  }

  // A national trunk prefix ("09876543210") is not part of the number.
  const national = digits.replace(/^0+/, '');
  return { code: fallbackCode, number: national };
}

// ── Campaign code ───────────────────────────────────────────────────────────

/**
 * Campaign_Code is mandatory and is what Salesforce uses to derive the
 * project, source and sub-source of the enquiry. It is resolved in order of
 * how specific the evidence is:
 *
 *   1. A code the page itself declared (a campaign landing page knows its own
 *      code with certainty; nothing inferred beats that).
 *   2. A code mapped from the campaign attribution — utm_id first, since ad
 *      platforms populate it with the campaign's own identifier, then the
 *      campaign name, then source/medium, then source alone.
 *   3. The default code, so an organic or direct enquiry still reaches
 *      Salesforce instead of being rejected for a field the visitor could
 *      never have supplied.
 */
export function resolveCampaignCode(enquiry = {}) {
  const explicit = trim(enquiry.campaignCode, 60);
  if (explicit) return explicit;

  let map = {};
  try {
    const raw = process.env.SALESFORCE_CAMPAIGN_CODE_MAP;
    if (raw && raw.trim()) map = JSON.parse(raw);
  } catch {
    // A malformed map must not stop lead delivery; the default code still
    // applies. The parse error is surfaced by validateCampaignCodeMap() at
    // boot rather than once per enquiry here.
    map = {};
  }

  const lookup = Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()])
  );

  const model = (process.env.SALESFORCE_ATTRIBUTION_MODEL || 'first').toLowerCase();
  const touch = (model === 'last' ? enquiry.lastTouch : enquiry.firstTouch) || {};

  const candidates = [
    touch.id,
    touch.campaign,
    touch.source && touch.medium ? `${touch.source}:${touch.medium}` : '',
    touch.source,
  ];

  for (const candidate of candidates) {
    const key = trim(candidate, 200).toLowerCase();
    if (key && lookup[key]) return lookup[key];
  }

  return trim(process.env.SALESFORCE_DEFAULT_CAMPAIGN_CODE, 60);
}

/** Returns a human-readable problem with SALESFORCE_CAMPAIGN_CODE_MAP, or null. */
export function validateCampaignCodeMap() {
  const raw = process.env.SALESFORCE_CAMPAIGN_CODE_MAP;
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'SALESFORCE_CAMPAIGN_CODE_MAP must be a JSON object of {"utm value": "CODE"}';
    }
    return null;
  } catch (error) {
    return `SALESFORCE_CAMPAIGN_CODE_MAP is not valid JSON (${error.message})`;
  }
}

// ── Payload ─────────────────────────────────────────────────────────────────

/**
 * The endpoint carries only five UTM slots. Source, medium and campaign are
 * fixed; the last two are configurable because which of term, content or a
 * click id matters most is a marketing decision, not an engineering one.
 */
function utmSlots(touch) {
  const pick = (key) => trim(touch[key], 255);
  return {
    UTMsource: pick('source'),
    UTMmedium: pick('medium'),
    UTMCampaign: pick('campaign'),
    UTMpara2: pick(process.env.SALESFORCE_UTM_PARA2 || 'term'),
    UTMpara3: pick(process.env.SALESFORCE_UTM_PARA3 || 'content'),
  };
}

/**
 * Whatever has no field on the endpoint goes into Comments, so no attribution
 * is lost even though the payload is narrower than what the site captures.
 */
function buildComments(enquiry, touch) {
  const lines = [
    enquiry.message || '(no message)',
    '',
    `Form: ${enquiry.formType || 'contact'}`,
    `Page: ${enquiry.pagePath || '—'}`,
    enquiry.interest ? `Interest: ${enquiry.interest}` : null,
    enquiry.email ? `Email: ${enquiry.email}` : null,
    enquiry.displayedPhone ? `Number shown to visitor: ${enquiry.displayedPhone}` : null,
    '',
    `Referrer: ${touch.referrer || 'direct'}`,
    `Landing page: ${touch.landingPage || '—'}`,
    touch.gclid ? `GCLID: ${touch.gclid}` : null,
    touch.fbclid ? `FBCLID: ${touch.fbclid}` : null,
    touch.msclkid ? `MSCLKID: ${touch.msclkid}` : null,
    '',
    `Consent given: ${enquiry.consent ? 'yes' : 'no'}`,
    `Submitted: ${new Date(enquiry.createdAt || Date.now()).toISOString()}`,
  ].filter((line) => line !== null);

  // Apex long text areas top out at 32k; 4k is ample and keeps the record readable.
  return lines.join('\n').slice(0, 4000);
}

export function buildEnquiryPayload(enquiry = {}) {
  const model = (process.env.SALESFORCE_ATTRIBUTION_MODEL || 'first').toLowerCase();
  const touch = (model === 'last' ? enquiry.lastTouch : enquiry.firstTouch) || {};
  const phone = splitPhone(enquiry.phone);

  const payload = {
    Name: trim(enquiry.name, 120),
    Country: trim(enquiry.country, 60) || process.env.SALESFORCE_DEFAULT_COUNTRY || 'India',
    Country_Code: trim(enquiry.countryCode, 8) || phone.code,
    Mobile: phone.number,
    Email: trim(enquiry.email, 200),
    Campaign_Code: resolveCampaignCode(enquiry),
    Customer_Origin: trim(enquiry.customerOrigin, 60),
    Configuration: trim(enquiry.configuration, 120) || trim(enquiry.interest, 120),
    Comments: buildComments(enquiry, touch),
    Prefferedatetime: formatDateTime(enquiry.preferredCallAt),
    PrefferedSVon: formatDateTime(enquiry.preferredVisitAt),
    PrefferedSVtype: trim(enquiry.preferredVisitType, 40),
    Preferred_Configuration_Budget: trim(enquiry.budget, 120),
    ...utmSlots(touch),
  };

  // Sending an empty string where the endpoint expects a picklist value is a
  // validation error; omitting the key is not. The mandatory three stay in
  // even when empty so the endpoint's own wording is what gets recorded.
  const mandatory = new Set(['Name', 'Mobile', 'Campaign_Code']);
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => mandatory.has(key) || value !== '')
  );
}

/**
 * The three mandatory fields, checked before the call goes out.
 *
 * Not distrust of the endpoint — it validates these itself — but the answer is
 * knowable here, and a rejection caught locally costs no API call, is reported
 * in the endpoint's own wording, and is marked permanent so the retry sweep
 * does not spend six attempts relearning it.
 */
export function missingMandatory(payload) {
  if (!payload.Name) return 'Please Provide Name';
  if (!payload.Mobile) return 'Please Provide Mobile Number';
  if (!payload.Campaign_Code) return 'Please Provide Campaign Code';
  return null;
}

// ── Transport ───────────────────────────────────────────────────────────────

export function enquiryEndpointPath() {
  const path = (process.env.SALESFORCE_ENQUIRY_PATH || DEFAULT_PATH).trim();
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Posts one enquiry. Throws on failure; the error carries `permanent` so the
 * caller can tell "will never work" from "try again in ten minutes".
 */
export async function createEnquiry(enquiry) {
  const payload = buildEnquiryPayload(enquiry);

  const missing = missingMandatory(payload);
  if (missing) {
    const error = new Error(missing);
    error.permanent = true;
    throw error;
  }

  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}${enquiryEndpointPath()}`;

  const send = (token) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

  let response = await send(accessToken);

  // A cached token can outlive its session — an admin revoke, a password
  // reset. One forced re-auth turns a permanent-looking failure into a
  // transient one.
  if (response.status === 401) {
    resetTokenCache();
    const fresh = await getAccessToken();
    response = await send(fresh.accessToken);
  }

  const text = await response.text();

  if (!response.ok) {
    // A 4xx here is the platform rejecting the request (wrong path, no access
    // to the Apex class), not the service rejecting the enquiry. Replaying an
    // identical body against an identical endpoint will not change a 404.
    const error = new Error(
      `Salesforce enquiry POST failed (${response.status}): ${text.slice(0, 400)}`
    );
    error.permanent = response.status === 404 || response.status === 403;
    throw error;
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Salesforce enquiry returned non-JSON: ${text.slice(0, 200)}`);
  }

  // The documented success shape. Anything else is a rejection, whatever the
  // HTTP status said.
  if (Number(body.status) === 200) {
    return {
      leadId: trim(body.id, 64),
      message: trim(body.message, 200) || 'Success',
      campaignCode: payload.Campaign_Code,
      mode: 'enquiry-api',
    };
  }

  const error = new Error(
    `Salesforce enquiry rejected (status ${body.status}): ${trim(body.message, 300) || 'no message'}`
  );
  // status 1 is the documented code for a missing or invalid required field.
  // That is a property of the data, not of the moment, so replaying it is
  // pure noise against the org's API limits.
  error.permanent = Number(body.status) === 1;
  error.responseMessage = trim(body.message, 300);
  throw error;
}

export default { createEnquiry, buildEnquiryPayload, resolveCampaignCode };
