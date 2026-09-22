import mongoose from 'mongoose';

/**
 * Corporate Association — the organisations Merlin is associated with:
 * institutional partners, banks and lenders, channel partners, industry
 * bodies, design and construction collaborators.
 *
 * These are usually presented as a logo wall, so `logo` is required in
 * practice and `order` carries real weight — the sequence of partner logos is
 * a commercial matter, not an alphabetical one.
 */
const associationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

    category: {
      type: String,
      enum: ['partner', 'financial', 'channel', 'institution', 'collaborator', 'other'],
      default: 'partner',
      index: true,
    },
    /** Shown as the group heading; falls back to a label derived from category. */
    categoryLabel: { type: String, default: '', trim: true, maxlength: 120 },

    logo: { type: String, default: '' },
    logoAlt: { type: String, default: '', trim: true, maxlength: 250 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    website: { type: String, default: '', trim: true, maxlength: 500 },

    /** Optional relationship window, for associations that ended. */
    since: { type: Number, default: null },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },

    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

associationSchema.index({ status: 1, category: 1, order: 1 });

const Association = mongoose.model('Association', associationSchema);

export default Association;
