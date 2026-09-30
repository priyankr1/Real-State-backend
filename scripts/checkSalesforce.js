import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });
dotenv.config();

const { getAccessToken } = await import('../services/salesforceAuth.js');
const { salesforceMode, salesforceConfigWarnings } = await import(
  '../services/salesforceService.js'
);
const { buildEnquiryPayload, enquiryEndpointPath, missingMandatory, createEnquiry } = await import(
  '../services/salesforceEnquiryApi.js'
);

/**
 * Verifies the Salesforce Web to Enquiry integration end to end.
 *
 *   npm run check:salesforce            auth + payload preview, writes nothing
 *   npm run check:salesforce -- --send  also creates one real enquiry record
 *
 * The dry run is the default on purpose: the only org anyone has credentials
 * for is production, and a verification script that silently files a fake
 * enquiry puts a test record in front of a salesperson.
 */

const SEND = process.argv.includes('--send');

/** Stands in for a real enquiry document — the same shape the model produces. */
const sample = {
  _id: 'smoke-test',
  name: process.env.SF_TEST_NAME || 'Integration Test',
  email: process.env.SF_TEST_EMAIL || 'integration.test@merlinprojects.com',
  phone: process.env.SF_TEST_PHONE || '+91 90000 00000',
  message: 'Automated integration check — please ignore.',
  interest: '2 BHK',
  formType: 'contact',
  pagePath: '/contact',
  consent: true,
  createdAt: new Date(),
  firstTouch: {
    source: 'website-check',
    medium: 'script',
    campaign: 'integration-check',
    term: '',
    content: '',
    referrer: '',
    landingPage: '/contact',
  },
  lastTouch: {},
};

const line = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);

console.log('\nSalesforce integration check\n' + '─'.repeat(46));

const mode = salesforceMode();
line('Mode', mode);
line('Login URL', process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com');
line('Endpoint path', enquiryEndpointPath());

const warnings = salesforceConfigWarnings();
if (warnings.length) {
  console.log('\nConfiguration warnings');
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (mode === 'off') {
  console.log(
    '\nSALESFORCE_MODE is "off" — nothing would be sent. Set it to "enquiry-api" to enable delivery.'
  );
}

// ── Auth ────────────────────────────────────────────────────────────────────

let instanceUrl = '';
try {
  const token = await getAccessToken();
  instanceUrl = token.instanceUrl;
  console.log('\nAuthentication  OK');
  line('Instance URL', token.instanceUrl);
  // Enough to tell two tokens apart in a log, not enough to use.
  line('Token', `${String(token.accessToken).slice(0, 12)}… (${token.accessToken.length} chars)`);
} catch (error) {
  console.error('\nAuthentication  FAILED');
  console.error(`  ${error.message}`);
  process.exitCode = 1;
  process.exit();
}

// ── Payload ─────────────────────────────────────────────────────────────────

const payload = buildEnquiryPayload(sample);
console.log(`\nPayload that would be POSTed to ${instanceUrl}${enquiryEndpointPath()}`);
console.log(JSON.stringify(payload, null, 2));

const missing = missingMandatory(payload);
if (missing) {
  console.error(`\nMandatory field check  FAILED — "${missing}"`);
  console.error('  Salesforce would reject this. Set SALESFORCE_DEFAULT_CAMPAIGN_CODE.');
  process.exitCode = 1;
} else {
  console.log('\nMandatory field check  OK');
}

// ── Optional live send ──────────────────────────────────────────────────────

if (!SEND) {
  console.log('\nDry run. Re-run with --send to create a real enquiry in the org.\n');
  process.exit();
}

if (missing) {
  console.error('\nRefusing to send an enquiry that is already known to be invalid.\n');
  process.exit();
}

console.log('\nSending…');
try {
  const result = await createEnquiry(sample);
  console.log('Delivered  OK');
  line('Record id', result.leadId || '(none returned)');
  line('Message', result.message);
  line('Campaign code', result.campaignCode);
  console.log('\nDelete this record in Salesforce once you have confirmed it.\n');
} catch (error) {
  console.error('Delivered  FAILED');
  console.error(`  ${error.message}`);
  console.error(`  Permanent: ${Boolean(error.permanent)}`);
  process.exitCode = 1;
}
