import fs from 'fs';
import cloudinary from '../config/cloudinary.js';
import logger from '../utils/logger.js';
import { sanitizeRichText, htmlToPlainText } from '../utils/sanitizeHtml.js';
import { uniqueSlug, slugify } from '../utils/slugify.js';
import { revalidateFrontend } from '../utils/revalidateFrontend.js';
import { logAdminActivity } from '../utils/activityLogger.js';

/**
 * A CRUD factory for the editorial content types.
 *
 * Media/Events/Awards, Gallery albums and Corporate Associations are the same
 * shape: slug, status, cover image, ordering, ISR purge on write. Writing
 * three near-identical controllers guarantees they drift — the third one
 * quietly forgets to purge the cache, or to sanitize, and nobody notices for
 * a year. One factory means one place to fix.
 *
 * Anything genuinely resource-specific arrives through `assign`.
 */

export const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

/** Accepts a JSON array, a comma-separated string, or an actual array. */
export const parseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  const raw = value.trim();
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through to comma splitting */
    }
  }
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
};

/** Accepts a JSON object or returns the fallback. Used for structured sub-documents. */
export const parseObject = (value, fallback = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

export const uploadImageFile = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `buildestate/${folder}`,
      resource_type: 'image',
    });
    return { url: result.secure_url, width: result.width, height: result.height };
  } finally {
    fs.unlink(file.path, (err) => {
      if (err) logger.warn('Failed to remove temp upload', { error: err.message });
    });
  }
};

/**
 * @param {object} config
 * @param {import('mongoose').Model} config.Model
 * @param {string} config.label            Human name, for logs and messages.
 * @param {string} config.targetType       Activity-log target type.
 * @param {string} config.folder           Cloudinary folder.
 * @param {string} config.listFields       Public projection.
 * @param {object} config.defaultSort
 * @param {(req) => object} [config.publicQuery]
 * @param {(doc, body, uploads) => Promise<void>|void} config.assign
 * @param {(doc) => string[]} config.paths  ISR paths a write invalidates.
 * @param {string[]} [config.richTextFields]
 */
export function createContentController(config) {
  const {
    Model,
    label,
    targetType,
    folder,
    listFields,
    defaultSort = { order: 1, createdAt: -1 },
    publicQuery = () => ({}),
    assign,
    paths,
    richTextFields = [],
  } = config;

  /**
   * Turns multer's `req.files` into `{ coverImage: {url,…}, images: [...] }`.
   * Field names are whatever the route's `upload.fields()` declared.
   */
  const collectUploads = async (files) => {
    const uploads = {};
    if (!files) return uploads;

    for (const [field, list] of Object.entries(files)) {
      if (!Array.isArray(list) || !list.length) continue;
      const results = await Promise.all(list.map((file) => uploadImageFile(file, folder)));
      uploads[field] = results.length === 1 ? results[0] : results;
      uploads[`${field}List`] = results;
    }
    return uploads;
  };

  const applyRichText = (doc, body) => {
    for (const field of richTextFields) {
      if (typeof body[field] === 'string') doc[field] = sanitizeRichText(body[field]);
    }
  };

  const purge = async (doc, extra = []) => {
    try {
      await revalidateFrontend([...paths(doc), ...extra]);
    } catch (error) {
      logger.warn(`${label} revalidate failed`, { error: error.message });
    }
  };

  // ── Public ────────────────────────────────────────────────────────────────

  const list = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
      const skip = (page - 1) * limit;

      const query = { status: 'published', ...publicQuery(req) };
      if (req.query.featured === 'true') query.featured = true;
      if (req.query.search) {
        const rx = new RegExp(escapeRegex(req.query.search), 'i');
        query.$or = [{ title: rx }, { name: rx }];
      }

      const [items, total] = await Promise.all([
        Model.find(query).select(listFields).sort(defaultSort).skip(skip).limit(limit).lean(),
        Model.countDocuments(query),
      ]);

      return res.json({
        success: true,
        items,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (error) {
      logger.error(`${label} list failed`, { error: error.message });
      return res.status(500).json({ success: false, message: `Could not load ${label}` });
    }
  };

  /** Slugs only — feeds generateStaticParams() and the sitemap. */
  const listSlugs = async (req, res) => {
    try {
      const slugs = await Model.find({ status: 'published' })
        .select('slug updatedAt')
        .sort({ updatedAt: -1 })
        .limit(2000)
        .lean();
      return res.json({ success: true, slugs });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Could not load slugs' });
    }
  };

  const getBySlug = async (req, res) => {
    try {
      const item = await Model.findOne({
        slug: String(req.params.slug || '').toLowerCase(),
        status: 'published',
      }).lean();

      if (!item) return res.status(404).json({ success: false, message: `${label} not found` });

      // Siblings, for the "more like this" strip. One extra query, cached by
      // ISR, so it costs nothing per visitor.
      const related = await Model.find({
        _id: { $ne: item._id },
        status: 'published',
        ...(item.category ? { category: item.category } : {}),
        ...(item.kind ? { kind: item.kind } : {}),
      })
        .select(listFields)
        .sort(defaultSort)
        .limit(3)
        .lean();

      return res.json({ success: true, item, related });
    } catch (error) {
      logger.error(`${label} getBySlug failed`, { error: error.message });
      return res.status(500).json({ success: false, message: `Could not load ${label}` });
    }
  };

  // ── Admin ─────────────────────────────────────────────────────────────────

  const adminList = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const query = {};
      if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
      if (req.query.kind && req.query.kind !== 'all') query.kind = req.query.kind;
      if (req.query.category && req.query.category !== 'all') query.category = req.query.category;
      if (req.query.search) {
        const rx = new RegExp(escapeRegex(req.query.search), 'i');
        query.$or = [{ title: rx }, { name: rx }, { slug: rx }];
      }

      const [items, total] = await Promise.all([
        Model.find(query)
          .select(listFields)
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Model.countDocuments(query),
      ]);

      return res.json({
        success: true,
        items,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (error) {
      logger.error(`${label} adminList failed`, { error: error.message });
      return res.status(500).json({ success: false, message: `Could not load ${label}` });
    }
  };

  const adminGet = async (req, res) => {
    try {
      const item = await Model.findById(req.params.id).lean();
      if (!item) return res.status(404).json({ success: false, message: `${label} not found` });
      return res.json({ success: true, item });
    } catch (error) {
      return res.status(500).json({ success: false, message: `Could not load ${label}` });
    }
  };

  const adminCreate = async (req, res) => {
    try {
      const body = req.body || {};
      const titleish = clean(body.title || body.name, 250);
      if (!titleish) {
        return res.status(400).json({ success: false, message: 'A title is required' });
      }

      const uploads = await collectUploads(req.files);
      const doc = new Model({
        slug: await uniqueSlug(Model, body.slug || titleish),
        createdBy: req.admin?.email || '',
      });

      await assign(doc, body, uploads);
      applyRichText(doc, body);
      await doc.save();

      await logAdminActivity(
        req.admin.email,
        `${targetType}_created`,
        targetType,
        doc._id,
        doc.title || doc.name,
        { status: doc.status },
        req
      );

      if (doc.status === 'published') await purge(doc);

      return res.status(201).json({ success: true, item: doc });
    } catch (error) {
      logger.error(`${label} create failed`, { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  const adminUpdate = async (req, res) => {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ success: false, message: `${label} not found` });

      const body = req.body || {};
      const previousSlug = doc.slug;
      const wasPublished = doc.status === 'published';

      // A slug is only regenerated when the editor explicitly sends a new one.
      // Never as a side effect of retitling — a published URL is a citation
      // and quietly changing it discards every link pointing at it.
      if (body.slug && String(body.slug).trim() && slugify(body.slug) !== doc.slug) {
        doc.slug = await uniqueSlug(Model, body.slug, doc._id);
      }

      const uploads = await collectUploads(req.files);
      await assign(doc, body, uploads);
      applyRichText(doc, body);
      await doc.save();

      await logAdminActivity(
        req.admin.email,
        `${targetType}_updated`,
        targetType,
        doc._id,
        doc.title || doc.name,
        { status: doc.status },
        req
      );

      // Purge the old path too, so a renamed item stops serving at both URLs
      // and an unpublished one actually disappears.
      const extra =
        previousSlug !== doc.slug || wasPublished
          ? paths({ ...doc.toObject(), slug: previousSlug })
          : [];
      await purge(doc, extra);

      return res.json({ success: true, item: doc });
    } catch (error) {
      logger.error(`${label} update failed`, { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  const adminDelete = async (req, res) => {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ success: false, message: `${label} not found` });

      const snapshot = doc.toObject();
      await doc.deleteOne();

      await logAdminActivity(
        req.admin.email,
        `${targetType}_deleted`,
        targetType,
        snapshot._id,
        snapshot.title || snapshot.name,
        { status: snapshot.status },
        req
      );

      await purge(snapshot);
      return res.json({ success: true, message: `${label} deleted` });
    } catch (error) {
      return res.status(500).json({ success: false, message: `Could not delete ${label}` });
    }
  };

  /** POST admin/upload-image — used by the rich-text editor and image pickers. */
  const adminUploadImage = async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
      const uploaded = await uploadImageFile(req.file, folder);
      return res.json({ success: true, ...uploaded });
    } catch (error) {
      logger.error(`${label} image upload failed`, { error: error.message });
      return res.status(500).json({ success: false, message: 'Upload failed' });
    }
  };

  return {
    list,
    listSlugs,
    getBySlug,
    adminList,
    adminGet,
    adminCreate,
    adminUpdate,
    adminDelete,
    adminUploadImage,
    // Exposed so a resource can reuse the plumbing in a bespoke handler.
    collectUploads,
    purge,
  };
}

export { htmlToPlainText };
