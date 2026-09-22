import LegalPage from '../models/legalPageModel.js';
import logger from '../utils/logger.js';
import { sanitizeRichText } from '../utils/sanitizeHtml.js';
import { revalidateFrontend } from '../utils/revalidateFrontend.js';
import { logAdminActivity } from '../utils/activityLogger.js';
import { clean, parseObject } from './contentController.js';

/**
 * Privacy Policy and Disclaimer.
 *
 * Not run through the content factory: these are singletons addressed by a
 * fixed key, never created or deleted by an editor, and never listed. Forcing
 * them through CRUD would let someone delete the privacy policy — which takes
 * the Google Ads account down with it.
 */

const ALLOWED_KEYS = ['privacy-policy', 'disclaimer', 'terms', 'cookie-policy'];

const DEFAULT_TITLES = {
  'privacy-policy': 'Privacy Policy',
  disclaimer: 'Disclaimer',
  terms: 'Terms of Use',
  'cookie-policy': 'Cookie Policy',
};

// ── Public ──────────────────────────────────────────────────────────────────

/** GET /api/legal/:key */
export const getLegalPage = async (req, res) => {
  try {
    const key = String(req.params.key || '').toLowerCase();
    if (!ALLOWED_KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    const page = await LegalPage.findOne({ key, status: 'published' }).lean();
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    return res.json({ success: true, page });
  } catch (error) {
    logger.error('getLegalPage failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Could not load page' });
  }
};

/** GET /api/legal — every published legal page, for the footer and sitemap. */
export const listLegalPages = async (req, res) => {
  try {
    const pages = await LegalPage.find({ status: 'published' })
      .select('key title effectiveDate version updatedAt')
      .lean();
    return res.json({ success: true, pages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load pages' });
  }
};

// ── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/legal/admin/all — includes drafts, and stubs for keys not yet written. */
export const adminListLegalPages = async (req, res) => {
  try {
    const existing = await LegalPage.find({}).lean();
    const byKey = Object.fromEntries(existing.map((p) => [p.key, p]));

    // Every allowed key is returned whether or not a document exists, so the
    // admin UI can show "Disclaimer — not written yet" rather than hiding it.
    const pages = ALLOWED_KEYS.map(
      (key) =>
        byKey[key] || {
          key,
          title: DEFAULT_TITLES[key],
          content: '',
          status: 'draft',
          version: '',
          effectiveDate: null,
          exists: false,
        }
    );

    return res.json({ success: true, pages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load pages' });
  }
};

/** GET /api/legal/admin/:key */
export const adminGetLegalPage = async (req, res) => {
  try {
    const key = String(req.params.key || '').toLowerCase();
    if (!ALLOWED_KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: 'Unknown page key' });
    }

    const page =
      (await LegalPage.findOne({ key }).lean()) || {
        key,
        title: DEFAULT_TITLES[key],
        content: '',
        status: 'draft',
        version: '1.0',
        effectiveDate: null,
        seo: {},
        exists: false,
      };

    return res.json({ success: true, page });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load page' });
  }
};

/**
 * PUT /api/legal/admin/:key
 * Upsert — an editor opening a page that has never been written should be
 * able to save it without a separate "create" step.
 */
export const adminSaveLegalPage = async (req, res) => {
  try {
    const key = String(req.params.key || '').toLowerCase();
    if (!ALLOWED_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: 'Unknown page key' });
    }

    const body = req.body || {};
    const page = (await LegalPage.findOne({ key })) || new LegalPage({ key });

    page.title = clean(body.title, 200) || DEFAULT_TITLES[key];
    if (typeof body.content === 'string') page.content = sanitizeRichText(body.content);
    if (body.version !== undefined) page.version = clean(body.version, 20) || '1.0';
    if (body.effectiveDate && !Number.isNaN(Date.parse(body.effectiveDate))) {
      page.effectiveDate = new Date(body.effectiveDate);
    }
    if (!page.effectiveDate) page.effectiveDate = new Date();
    if (body.status !== undefined) page.status = body.status === 'published' ? 'published' : 'draft';

    const seo = parseObject(body.seo);
    if (Object.keys(seo).length) {
      page.seo = {
        metaTitle: clean(seo.metaTitle, 200),
        metaDescription: clean(seo.metaDescription, 400),
        noIndex: seo.noIndex === true || seo.noIndex === 'true',
      };
    }

    page.updatedBy = req.admin?.email || '';
    await page.save();

    await logAdminActivity(
      req.admin.email,
      'legal_updated',
      'legal',
      page._id,
      page.title,
      { status: page.status },
      req
    );

    try {
      await revalidateFrontend([`/${key}`, '/archive']);
    } catch (error) {
      logger.warn('Legal page revalidate failed', { error: error.message });
    }

    return res.json({ success: true, page });
  } catch (error) {
    logger.error('adminSaveLegalPage failed', { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
