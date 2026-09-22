import mongoose from "mongoose";

/**
 * Blog post.
 *
 * `content` holds sanitized HTML produced by the admin rich-text editor —
 * sanitization happens at the write boundary (utils/sanitizeHtml.js) so what
 * is stored is already safe to render with dangerouslySetInnerHTML.
 *
 * `slug` is the public identifier; every published post is reachable at
 * /blog/<slug> and is prerendered by the Next.js frontend.
 */
const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    // Public URL key. Unique across all posts, including drafts, so promoting
    // a draft to published can never collide with a live URL.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Short summary used in cards, meta description fallback and RSS.
    excerpt: {
      type: String,
      default: "",
      trim: true,
      maxlength: 320,
    },
    // Sanitized HTML body.
    content: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String,
      default: "",
    },
    // Alt text for the cover. Empty means the cover is decorative, but we
    // fall back to the title when rendering so links keep an accessible name.
    coverImageAlt: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "Insights",
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      name: { type: String, default: "Merlin Editorial" },
      role: { type: String, default: "" },
      avatar: { type: String, default: "" },
      /**
       * Short author bio, shown under the article.
       *
       * Asked for in the content checklist alongside the name and photograph.
       * Optional: an empty bio renders nothing rather than an empty byline box.
       */
      bio: { type: String, default: "", trim: true, maxlength: 600 },
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    // Set the first time status flips to "published". Kept afterwards so
    // re-publishing does not reset the original publication date.
    publishedAt: {
      type: Date,
      default: null,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    // Minutes, derived from the body on every write.
    readingTime: {
      type: Number,
      default: 1,
    },
    views: {
      type: Number,
      default: 0,
    },
    // Per-post SEO overrides. All optional — the frontend falls back to
    // title/excerpt when these are blank.
    seo: {
      metaTitle: { type: String, default: "", trim: true, maxlength: 70 },
      metaDescription: { type: String, default: "", trim: true, maxlength: 180 },
      keywords: { type: [String], default: [] },
      canonicalUrl: { type: String, default: "", trim: true },
      noIndex: { type: Boolean, default: false },
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Drives the public listing (published, newest first) and the category feeds.
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ status: 1, category: 1, publishedAt: -1 });
// Text search across the fields a reader would search by.
blogSchema.index({ title: "text", excerpt: "text", tags: "text" });

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;
