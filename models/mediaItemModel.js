import mongoose from 'mongoose';

/**
 * Media, Events & Awards.
 *
 * One collection with a `kind` discriminator rather than three collections:
 * the page shows them together, they share every field, and a press mention
 * about an award should not have to exist twice. Splitting them would mean
 * three admin screens and a merged sort at read time for no benefit.
 */
const mediaItemSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['media', 'event', 'award'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 250 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    summary: { type: String, default: '', trim: true, maxlength: 500 },
    /** Sanitized HTML. Optional — a press clipping is often just a link. */
    content: { type: String, default: '' },

    /** The date the thing happened, not the date the record was made. */
    date: { type: Date, required: true, index: true },

    coverImage: { type: String, default: '' },
    coverImageAlt: { type: String, default: '', trim: true, maxlength: 250 },
    /** Event photo sets and award ceremony shots. */
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, default: '', trim: true, maxlength: 250 },
        caption: { type: String, default: '', trim: true, maxlength: 300 },
        _id: false,
      },
    ],

    // ── kind-specific, all optional ─────────────────────────────────────────
    /** media: the masthead that ran it. award: the body that gave it. */
    publication: { type: String, default: '', trim: true, maxlength: 200 },
    /** Link out to the original article or the awarding body. */
    externalUrl: { type: String, default: '', trim: true, maxlength: 500 },
    /** event: where it was held. */
    location: { type: String, default: '', trim: true, maxlength: 250 },
    /** award: the category won. */
    category: { type: String, default: '', trim: true, maxlength: 200 },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    featured: { type: Boolean, default: false },
    /** Manual ordering within a kind. Lower sorts first; ties fall back to date. */
    order: { type: Number, default: 0 },

    seo: {
      metaTitle: { type: String, default: '', maxlength: 200 },
      metaDescription: { type: String, default: '', maxlength: 400 },
      noIndex: { type: Boolean, default: false },
    },

    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

mediaItemSchema.index({ status: 1, kind: 1, date: -1 });
mediaItemSchema.index({ status: 1, date: -1 });

const MediaItem = mongoose.model('MediaItem', mediaItemSchema);

export default MediaItem;
