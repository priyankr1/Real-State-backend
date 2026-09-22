import logger from './logger.js';

/**
 * Google reCAPTCHA v3 verification.
 *
 * v3 does not challenge anyone. It returns a score from 0.0 (almost certainly
 * a bot) to 1.0 (almost certainly human) and leaves the policy decision here.
 *
 * Three decisions worth stating, because each has a failure mode that only
 * shows up in production:
 *
 * 1. **Unconfigured means disabled, not blocked.** With no secret key this
 *    returns `{ skipped: true }` and lead capture works exactly as before.
 *    The alternative — failing closed on a missing env var — turns a
 *    deployment oversight into total, silent lead loss.
 *
 * 2. **Google being unreachable does not reject the lead.** A timeout or a 5xx
 *    from siteverify is Google's outage, not evidence about the visitor.
 *    Rejecting on it would mean an upstream blip costs real enquiries, which is
 *    a far larger business loss than the spam it would prevent. The lead is
 *    accepted and marked `unverified` so it is auditable afterwards.
 *
 * 3. **The score is recorded either way.** Blocking outright at a threshold
 *    guarantees some real buyers are turned away invisibly. Storing the score
 *    lets the threshold be tuned against actual data instead of a guess, and
 *    lets a borderline lead be reviewed by a human rather than discarded.
 */

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/** Below this the submission is treated as spam. 0.5 is Google's own suggestion. */
const DEFAULT_THRESHOLD = 0.5;

export const recaptchaConfigured = () => Boolean(process.env.RECAPTCHA_SECRET_KEY);

export const recaptchaThreshold = () => {
  const raw = Number.parseFloat(process.env.RECAPTCHA_MIN_SCORE || '');
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : DEFAULT_THRESHOLD;
};

/**
 * @param {string} token       The `g-recaptcha-response` token from the browser.
 * @param {string} remoteIp    Optional, improves scoring.
 * @param {string} expectedAction  The action name the client used, e.g. 'enquiry'.
 * @returns {Promise<{ skipped?: boolean, ok: boolean, score: number|null, action: string, reason: string }>}
 */
export async function verifyRecaptcha(token, remoteIp = '', expectedAction = '') {
  if (!recaptchaConfigured()) {
    return { skipped: true, ok: true, score: null, action: '', reason: 'not-configured' };
  }

  if (!token) {
    return { ok: false, score: null, action: '', reason: 'missing-token' };
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: token,
    });
    if (remoteIp) params.set('remoteip', remoteIp);

    // A hung request here would hold the visitor's form submission open, so it
    // is bounded and treated as "unknown" rather than "bot" on timeout.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let payload;
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: controller.signal,
      });
      payload = await response.json();
    } finally {
      clearTimeout(timeout);
    }

    const score = typeof payload?.score === 'number' ? payload.score : null;
    const action = String(payload?.action || '');

    if (!payload?.success) {
      const codes = Array.isArray(payload?.['error-codes']) ? payload['error-codes'] : [];

      // These mean the integration is broken, not that the visitor is a bot.
      // Rejecting real people because a key was mistyped is the worse outcome,
      // so it is logged loudly and the lead is let through.
      const integrationErrors = ['invalid-input-secret', 'bad-request', 'invalid-keys'];
      if (codes.some((code) => integrationErrors.includes(code))) {
        logger.error('reCAPTCHA is misconfigured — check RECAPTCHA_SECRET_KEY', { codes });
        return { ok: true, score, action, reason: `misconfigured:${codes.join(',')}` };
      }

      return { ok: false, score, action, reason: codes.join(',') || 'verification-failed' };
    }

    // A valid token for a different action means it was lifted from elsewhere
    // on the site and replayed against this endpoint.
    if (expectedAction && action && action !== expectedAction) {
      return { ok: false, score, action, reason: `action-mismatch:${action}` };
    }

    const threshold = recaptchaThreshold();
    if (score !== null && score < threshold) {
      return { ok: false, score, action, reason: `low-score:${score}` };
    }

    return { ok: true, score, action, reason: 'ok' };
  } catch (error) {
    // Abort, DNS failure, Google outage. Not the visitor's fault.
    logger.warn('reCAPTCHA verification unavailable — accepting unverified', {
      error: error.message,
    });
    return { ok: true, score: null, action: '', reason: 'unverified' };
  }
}

export default verifyRecaptcha;
