import mongoose from 'mongoose';

/**
 * A gallery album — a set of photographs under one title.
 *
 * Images carry their own dimensions because the frontend needs an intrinsic
 * aspect ratio to reserve space before the file arrives. Without it every
 * gallery load is a cascade of layout shift, which is both the worst CLS
 * offender on a site like this and the easiest to avoid.
 */
const galleryImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: '', trim: true, maxlength: 250 },
    caption: { type: String, default: '', trim: true, maxlength: 300 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const galleryAlbumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: '', trim: true, maxlength: 1000 },

    /** Free-text grouping: "Residential", "Commercial", "Events", a project name. */
    category: { type: String, default: '', trim: true, maxlength: 120, index: true },
    location: { type: String, default: '', trim: true, maxlength: 200 },

    coverImage: { type: String, default: '' },
    coverImageAlt: { type: String, default: '', trim: true, maxlength: 250 },
    images: { type: [galleryImageSchema], default: [] },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    featured: { type: Boolean, default: false },
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

galleryAlbumSchema.index({ status: 1, order: 1, createdAt: -1 });
galleryAlbumSchema.index({ status: 1, category: 1 });

const GalleryAlbum = mongoose.model('GalleryAlbum', galleryAlbumSchema);

export default GalleryAlbum;
