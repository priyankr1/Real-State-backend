/**
 * OAuth 2.0 against the Salesforce org, shared by every transport.
 *
 * Merlin's integration document specifies the username/password grant against
 * https://login.salesforce.com/services/oauth2/token. That flow is used when a
 * username and password are configured; otherwise this falls back to client
 * credentials, which is the better flow where the org has enabled a run-as
 * user (no user password to rotate, nothing to leak).
 *
 * Kept separate from the transports so that both the Lead REST API and the
 * Merlin InsertNewEnquiry endpoint share one token and one re-auth path,
 * rather than each holding its own cache and each burning its own login call.
 */

/**
 * Salesforce tokens are long-lived and logins are rate-limited per user, so
 * re-authenticating per lead is both wasteful and a way to get locked out.
 */
let tokenCache = { accessToken: null, instanceUrl: null, expiresAt: 0 };

export function loginUrl() {
  return (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(/\/+$/, '');
}

/** Called after a 401 so the next call re-authenticates instead of replaying a dead token. */
export function resetTokenCache() {
  tokenCache = { accessToken: null, instanceUrl: null, expiresAt: 0 };
}

export async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache;
  }

  const body = new URLSearchParams();
  body.set('client_id', process.env.SALESFORCE_CLIENT_ID || '');
  body.set('client_secret', process.env.SALESFORCE_CLIENT_SECRET || '');

  if (process.env.SALESFORCE_USERNAME && process.env.SALESFORCE_PASSWORD) {
    body.set('grant_type', 'password');
    body.set('username', process.env.SALESFORCE_USERNAME);
    // Salesforce expects the security token concatenated onto the password.
    // Orgs that have whitelisted the server's IP issue no token, hence the
    // empty default rather than a required variable.
    body.set(
      'password',
      `${process.env.SALESFORCE_PASSWORD}${process.env.SALESFORCE_SECURITY_TOKEN || ''}`
    );
  } else {
    body.set('grant_type', 'client_credentials');
  }

  const response = await fetch(`${loginUrl()}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  if (!response.ok) {
    // Truncated deliberately: an auth error body can echo the request back,
    // and this string is stored on the enquiry and shown in the admin panel.
    throw new Error(`Salesforce auth failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = JSON.parse(text);
  tokenCache = {
    accessToken: data.access_token,
    instanceUrl: (data.instance_url || process.env.SALESFORCE_INSTANCE_URL || '').replace(
      /\/+$/,
      ''
    ),
    // Neither grant returns expires_in. 90 minutes sits comfortably inside the
    // default two-hour session timeout, and a 401 clears the cache anyway.
    expiresAt: Date.now() + 90 * 60 * 1000,
  };

  if (!tokenCache.accessToken) {
    throw new Error('Salesforce auth returned no access_token');
  }
  if (!tokenCache.instanceUrl) {
    throw new Error('Salesforce auth returned no instance_url and SALESFORCE_INSTANCE_URL is unset');
  }

  return tokenCache;
}

export default { getAccessToken, resetTokenCache, loginUrl };
