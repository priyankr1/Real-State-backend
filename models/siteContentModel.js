import mongoose from 'mongoose';

/**
 * The page content that is not a list of things.
 *
 * Blogs, media items, gallery albums and associations are collections — many
 * rows of one shape — and they already have their own models. The homepage,
 * the About Us page and the site-wide chrome are the opposite: one document
 * each, with a rich nested shape that differs per page. Modelling those as a
 * collection would mean inventing an ordering and a "which one is live?"
 * question that has no answer.
 *
 * So: one document per key, addressed by that key, never created or deleted
 * through the UI. Same reasoning as `legalPageModel` — an editor who can
 * delete the homepage will eventually delete the homepage.
 *
 * `data` is `Mixed` deliberately. Each key has a different shape and Mongoose
 * cannot express "this shape when key=home, that shape when key=settings"
 * without three models. The shape is enforced at the write boundary instead,
 * by the normalizers in `siteContentController.js`, which build the stored
 * object field by field from an allowlist. Nothing an editor POSTs is ever
 * merged in blind, so `Mixed` here is not a hole — it is a store for an
 * already-validated value.
 */
const siteContentSchema = new mongoose.Schema(
  {
    /** Stable identifier: home, about, settings. */
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /** Human label, for the admin list. */
    label: { type: String, default: '', trim: true, maxlength: 120 },

    /** The normalized content tree. See the per-key normalizers. */
    data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    /**
     * Draft content is invisible to the public API, so an editor can stage a
     * homepage rewrite without it going live mid-edit. The frontend falls back
     * to its built-in defaults when a key is unpublished, which is why an
     * unpublished homepage renders the shipped copy rather than an empty page.
     */
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },

    /**
     * Bumped on every save. The frontend does not use it; a human diffing two
     * exports does, and "which version was live when that campaign ran?" is
     * otherwise unanswerable.
     */
    revision: { type: Number, default: 0 },

    updatedBy: { type: String, default: '' },
  },
  { timestamps: true, minimize: false }
);

const SiteContent = mongoose.model('SiteContent', siteContentSchema);

export default SiteContent;
