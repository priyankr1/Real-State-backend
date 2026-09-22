import crypto from 'crypto';
import Enquiry from '../models/enquiryModel.js';
import emailService from '../services/emailService.js';
import { sendLead, salesforceMode } from '../services/salesforceService.js';
import logger from '../utils/logger.js';
import { logAdminActivity } from '../utils/activityLogger.js';
import { verifyRecaptcha } from '../utils/recaptcha.js';

const escHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

/** Salted so the table cannot be reversed into an IP list with a rainbow table. */
const hashIp = (ip) =>
  ip
    ? crypto
        .createHash('sha256')
        .update(`${ip}${process.env.JWT_SECRET || 'enquiry-salt'}`)
        .digest('hex')
        .slice(0, 32)
    : '';

/**
 * Normalises one attribution touch from whatever the client sent.
 *
 * Client-supplied and therefore untrusted: every field is length-capped and
 * stored as an opaque string. Nothing here is ever interpolated into a query
 * or rendered as HTML without escaping.
 */
const normaliseTouch = (raw = {}) => ({
  source: clean(raw.source, 120),
  medium: clean(raw.medium, 120),
  campaign: clean(raw.campaign, 200),
  term: clean(raw.term, 200),
  content: clean(raw.content, 200),
  id: clean(raw.id, 120),
  gclid: clean(raw.gclid, 255),
  fbclid: clean(raw.fbclid, 255),
  msclkid: clean(raw.msclkid, 255),
  referrer: clean(raw.referrer, 500),
  landingPage: clean(raw.landingPage, 500),
  at: raw.at && !Number.isNaN(Date.parse(raw.at)) ? new Date(raw.at) : new Date(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Public ──────────────────────────────────────────────────────────────────

/**
 * POST /api/enquiries
 *
 * Order of operations matters: the enquiry is persisted BEFORE the email and
 * before Salesforce. A lead that reached MongoDB is never lost, whatever
 * happens downstream — both notification and CRM sync are retryable, a
 * dropped HTTP request is not.
 */
export const submitEnquiry = async (req, res) => {
  try {
    const body = req.body || {};

    // Honeypot. A field styled off-screen that humans never see and naive
    // bots always fill. Answer 200 so the bot believes it succeeded and does
    // not escalate to a different technique.
    if (clean(body.company_website, 200)) {
      logger.info('Enquiry honeypot triggered', { requestId: req.requestId });
      return res.json({ success: true, message: 'Thank you — we will be in touch shortly.' });
    }

    const name = clean(body.name, 120);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 32);
    const message = clean(body.message, 4000);

    if (!name || !email) {
      return res
        .status(400)
        .json({ success: false, message: 'Please provide your name and email address.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    /**
     * reCAPTCHA v3, checked after the cheap validation above so a malformed
     * submission never costs a round trip to Google.
     *
     * A failed check answers 200, exactly as the honeypot does. Telling a bot
     * which defence stopped it is telling it what to change.
     */
    const captcha = await verifyRecaptcha(
      clean(body.recaptchaToken, 4000),
      req.ip,
      'enquiry'
    );

    if (!captcha.ok) {
      logger.info('Enquiry rejected by reCAPTCHA', {
        requestId: req.requestId,
        score: captcha.score,
        reason: captcha.reason,
      });
      return res.json({ success: true, message: 'Thank you — we will be in touch shortly.' });
    }

    const attribution = body.attribution || {};

    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      message,
      interest: clean(body.interest, 200),
      formType: clean(body.formType, 40) || 'contact',
      pagePath: clean(body.pagePath, 500),
      pageTitle: clean(body.pageTitle, 300),
      firstTouch: normaliseTouch(attribution.firstTouch),
      lastTouch: normaliseTouch(attribution.lastTouch),
      displayedPhone: clean(body.displayedPhone, 32),
      phoneSource: clean(body.phoneSource, 60),
      consent: Boolean(body.consent),
      consentText: clean(body.consentText, 500),
      userAgent: clean(req.headers['user-agent'], 500),
      ipHash: hashIp(req.ip),
      recaptcha: {
        // `skipped` means no secret key is configured — not that it passed.
        verified: Boolean(captcha.ok && !captcha.skipped && captcha.reason === 'ok'),
        score: captcha.score,
        action: captcha.action,
        reason: captcha.reason,
      },
      salesforce: { status: salesforceMode() === 'off' ? 'skipped' : 'pending' },
    });

    // Both of the following are deliberately not awaited by the response.
    // The visitor should see confirmation as soon as their lead is durable.
    notifyAdmin(enquiry);
    syncToSalesforce(enquiry._id);

    return res.json({
      success: true,
      message: 'Thank you — we will be in touch shortly.',
      id: enquiry._id,
    });
  } catch (error) {
    logger.error('Enquiry submission failed', { error: error.message, requestId: req.requestId });
    return res
      .status(500)
      .json({ success: false, message: 'We could not send that just now. Please try again.' });
  }
};

function notifyAdmin(enquiry) {
  const to = process.env.ENQUIRY_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;

  const row = (label, value) =>
    value
      ? `<tr><td style="padding:6px 14px;color:#6B7280;">${escHtml(label)}</td><td style="padding:6px 14px;font-weight:600;">${escHtml(value)}</td></tr>`
      : '';

  const t = enquiry.firstTouch || {};
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;">
    <h2 style="margin:0 0 4px;">New website enquiry</h2>
    <p style="margin:0 0 18px;color:#6B7280;">${escHtml(enquiry.formType)} form · ${escHtml(enquiry.pagePath || '/')}</p>
    <table style="border-collapse:collapse;margin-bottom:22px;">
      ${row('Name', enquiry.name)}
      ${row('Email', enquiry.email)}
      ${row('Phone', enquiry.phone)}
      ${row('Interest', enquiry.interest)}
      ${row('Message', enquiry.message)}
    </table>
    <h3 style="margin:0 0 6px;font-size:14px;">Campaign attribution</h3>
    <table style="border-collapse:collapse;">
      ${row('Source', t.source || 'direct')}
      ${row('Medium', t.medium)}
      ${row('Campaign', t.campaign)}
      ${row('Term', t.term)}
      ${row('Content', t.content)}
      ${row('GCLID', t.gclid)}
      ${row('Landing page', t.landingPage)}
      ${row('Referrer', t.referrer)}
      ${row('Number shown', enquiry.displayedPhone)}
    </table>
  </body></html>`;

  emailService.sendEmailSafely(to, `New enquiry: ${enquiry.name}`, html);
}

/**
 * Pushes an enquiry to Salesforce and records the outcome on the document.
 * Reloads by id rather than taking the object so a retry always sends the
 * current state, including an admin's later edits.
 */
async function syncToSalesforce(enquiryId) {
  try {
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) return;
    if (enquiry.salesforce?.status === 'synced') return;

    const result = await sendLead(enquiry);

    if (result.skipped) {
      enquiry.salesforce.status = 'skipped';
      enquiry.salesforce.lastError = result.reason || '';
    } else if (result.ok) {
      enquiry.salesforce.status = 'synced';
      enquiry.salesforce.leadId = result.leadId || '';
      enquiry.salesforce.syncedAt = new Date();
      enquiry.salesforce.mode = result.mode || '';
      enquiry.salesforce.lastError = '';
    } else {
      enquiry.salesforce.status = 'failed';
      enquiry.salesforce.lastError = String(result.error || 'unknown').slice(0, 500);
      enquiry.salesforce.mode = result.mode || '';
    }

    enquiry.salesforce.attempts = (enquiry.salesforce.attempts || 0) + 1;
    await enquiry.save();
  } catch (error) {
    logger.error('Salesforce sync bookkeeping failed', { enquiryId, error: error.message });
  }
}

export { syncToSalesforce };

// ── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/enquiries/admin/all */
export const adminListEnquiries = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.formType && req.query.formType !== 'all') query.formType = req.query.formType;
    if (req.query.sync && req.query.sync !== 'all') query['salesforce.status'] = req.query.sync;
    if (req.query.source) {
      query['firstTouch.source'] = new RegExp('^' + escapeRegex(req.query.source) + '$', 'i');
    }
    if (req.query.campaign) {
      query['firstTouch.campaign'] = new RegExp(escapeRegex(req.query.campaign), 'i');
    }
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), 'i');
      query.$or = [{ name: rx }, { email: rx }, { phone: rx }, { message: rx }];
    }
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) query.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }

    const [enquiries, total] = await Promise.all([
      Enquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Enquiry.countDocuments(query),
    ]);

    return res.json({
      success: true,
      enquiries,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      salesforceMode: salesforceMode(),
    });
  } catch (error) {
    logger.error('adminListEnquiries failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Could not load enquiries' });
  }
};

/** GET /api/enquiries/admin/stats — the campaign attribution summary. */
export const adminEnquiryStats = async (req, res) => {
  try {
    const since = new Date(Date.now() - (parseInt(req.query.days, 10) || 30) * 86400000);

    const [bySource, byStatus, byForm, totals] = await Promise.all([
      Enquiry.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              source: { $ifNull: ['$firstTouch.source', ''] },
              medium: { $ifNull: ['$firstTouch.medium', ''] },
              campaign: { $ifNull: ['$firstTouch.campaign', ''] },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      Enquiry.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Enquiry.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$formType', count: { $sum: 1 } } },
      ]),
      Enquiry.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            synced: {
              $sum: { $cond: [{ $eq: ['$salesforce.status', 'synced'] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$salesforce.status', 'failed'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      days: parseInt(req.query.days, 10) || 30,
      bySource: bySource.map((r) => ({
        source: r._id.source || 'direct',
        medium: r._id.medium || '—',
        campaign: r._id.campaign || '—',
        count: r.count,
      })),
      byStatus: Object.fromEntries(byStatus.map((r) => [r._id || 'new', r.count])),
      byForm: Object.fromEntries(byForm.map((r) => [r._id || 'contact', r.count])),
      totals: totals[0] || { total: 0, synced: 0, failed: 0 },
      salesforceMode: salesforceMode(),
    });
  } catch (error) {
    logger.error('adminEnquiryStats failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Could not load statistics' });
  }
};

/** GET /api/enquiries/admin/export — CSV for the marketing team. */
export const adminExportEnquiries = async (req, res) => {
  try {
    const query = {};
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) query.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }

    const rows = await Enquiry.find(query).sort({ createdAt: -1 }).limit(5000).lean();

    const columns = [
      'Date', 'Name', 'Email', 'Phone', 'Form', 'Page', 'Interest', 'Message',
      'Source', 'Medium', 'Campaign', 'Term', 'Content', 'GCLID',
      'Landing page', 'Referrer', 'Number shown', 'Status', 'Salesforce', 'Lead ID',
    ];

    // A leading =, +, - or @ makes Excel treat a cell as a formula, which is a
    // real injection route for a field a stranger typed. Prefixing with a
    // quote neutralises it without altering what a human reads.
    const cell = (value) => {
      const s = String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    };

    const csv = [
      columns.join(','),
      ...rows.map((r) =>
        [
          new Date(r.createdAt).toISOString(),
          r.name, r.email, r.phone, r.formType, r.pagePath, r.interest, r.message,
          r.firstTouch?.source, r.firstTouch?.medium, r.firstTouch?.campaign,
          r.firstTouch?.term, r.firstTouch?.content, r.firstTouch?.gclid,
          r.firstTouch?.landingPage, r.firstTouch?.referrer,
          r.displayedPhone, r.status, r.salesforce?.status, r.salesforce?.leadId,
        ]
          .map(cell)
          .join(',')
      ),
    ].join('\n');

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="merlin-enquiries-${stamp}.csv"`);
    // Excel reads UTF-8 as the local codepage without a BOM, mangling names.
    return res.send('﻿' + csv);
  } catch (error) {
    logger.error('adminExportEnquiries failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /api/enquiries/admin/:id */
export const adminGetEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).lean();
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load enquiry' });
  }
};

/** PUT /api/enquiries/admin/:id — status and internal notes only. */
export const adminUpdateEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    if (req.body.status) enquiry.status = req.body.status;
    if (typeof req.body.notes === 'string') enquiry.notes = clean(req.body.notes, 4000);
    await enquiry.save();

    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not update enquiry' });
  }
};

/** POST /api/enquiries/admin/:id/resync */
export const adminResyncEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    // Reset so a previously synced lead can be pushed again on purpose.
    enquiry.salesforce.status = 'pending';
    await enquiry.save();
    await syncToSalesforce(enquiry._id);

    const updated = await Enquiry.findById(req.params.id).lean();
    return res.json({ success: true, enquiry: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Resync failed' });
  }
};

/** DELETE /api/enquiries/admin/:id */
export const adminDeleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    await logAdminActivity(
      req.admin.email,
      'enquiry_deleted',
      'enquiry',
      enquiry._id,
      enquiry.name,
      { status: enquiry.status },
      req
    );

    return res.json({ success: true, message: 'Enquiry deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not delete enquiry' });
  }
};
