import mongoose from 'mongoose';

/**
 * Privacy Policy, Disclaimer and any other standing legal text.
 *
 * These live in the database rather than in the codebase for one reason:
 * legal copy changes on legal's timetable, not on a deploy schedule, and the
 * person who needs to change it does not have a git account.
 *
 * `effectiveDate` and `version` are not decoration. If a visitor later
 * disputes what they consented to, the answer is "this text, effective from
 * this date" — a policy page with no history cannot answer that.
 */
const legalPageSchema = new mongoose.Schema(
  {
    /** Stable identifier used in the URL: privacy-policy, disclaimer, terms. */
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    /** Sanitized HTML from the same editor as the blog. */
    content: { type: String, default: '' },

    effectiveDate: { type: Date, default: Date.now },
    version: { type: String, default: '1.0', trim: true, maxlength: 20 },

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },

    seo: {
      metaTitle: { type: String, default: '', maxlength: 200 },
      metaDescription: { type: String, default: '', maxlength: 400 },
      /**
       * Legal pages are indexable by default — Google expects a reachable
       * privacy policy, and Ads disapproves accounts whose policy 404s or is
       * noindexed. Only set this if legal explicitly asks.
       */
      noIndex: { type: Boolean, default: false },
    },

    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

const LegalPage = mongoose.model('LegalPage', legalPageSchema);

export default LegalPage;
