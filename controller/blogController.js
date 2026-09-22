import fs from "fs";
import cloudinary from "../config/cloudinary.js";
import Blog from "../models/blogModel.js";
import logger from "../utils/logger.js";
import { sanitizeRichText, htmlToPlainText } from "../utils/sanitizeHtml.js";
import { uniqueSlug, slugify } from "../utils/slugify.js";
import { revalidateFrontend } from "../utils/revalidateFrontend.js";
import { logAdminActivity } from "../utils/activityLogger.js";

// Fields the public list endpoints return. Deliberately excludes `content`:
// bodies are tens of KB each and a card list never renders them.
const CARD_FIELDS =
  "title slug excerpt coverImage coverImageAlt category tags author status publishedAt featured readingTime views createdAt updatedAt";

const WORDS_PER_MINUTE = 220;

/** Escapes user input before it is interpolated into a RegExp. */
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readingTimeOf = (html) => {
  const words = htmlToPlainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};

const excerptOf = (html, limit = 200) => {
  const text = htmlToPlainText(html);
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, "") + "…";
};

/** Accepts a JSON array, a comma-separated string, or an actual array. */
const parseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  const raw = value.trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      /* fall through to comma splitting */
    }
  }
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
};

const uploadImageFile = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "buildestate/blog",
      resource_type: "image",
    });
    return result.secure_url;
  } finally {
    fs.unlink(file.path, (err) => {
      if (err) logger.warn("Failed to remove temp upload", { error: err.message });
    });
  }
};

// Paths whose ISR cache a post mutation invalidates.
const pathsFor = (post) => [
  "/",
  "/blog",
  "/archive",
  "/blog/" + post.slug,
  post.category ? "/blog/category/" + slugify(post.category) : null,
];

// ── Public ──────────────────────────────────────────────────────────────────

/**
 * GET /api/blogs
 * Published posts only, newest first, with pagination + facet filters.
 */
export const listBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const query = { status: "published" };
    if (req.query.category) {
      query.category = new RegExp("^" + escapeRegex(req.query.category) + "$", "i");
    }
    if (req.query.tag) {
      query.tags = new RegExp("^" + escapeRegex(req.query.tag) + "$", "i");
    }
    if (req.query.featured === "true") query.featured = true;
    if (req.query.search) {
      const term = escapeRegex(String(req.query.search).slice(0, 80));
      query.$or = [
        { title: new RegExp(term, "i") },
        { excerpt: new RegExp(term, "i") },
        { tags: new RegExp(term, "i") },
      ];
    }

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .select(CARD_FIELDS)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      blogs,
      pagination: {
        currentPage: page,
        totalPages,
        totalBlogs: total,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
      },
    });
  } catch (error) {
    logger.error("Error listing blogs", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load blog posts", blogs: [] });
  }
};

/**
 * GET /api/blogs/slugs
 * Every published slug — feeds the frontend's generateStaticParams() and sitemap.
 */
export const listBlogSlugs = async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "published" })
      .select("slug updatedAt publishedAt category")
      .sort({ publishedAt: -1 })
      .limit(5000)
      .lean();
    res.json({ success: true, slugs: blogs });
  } catch (error) {
    logger.error("Error listing blog slugs", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load slugs", slugs: [] });
  }
};

/**
 * GET /api/blogs/categories
 * Category facets with post counts, for nav and topic hubs.
 */
export const listBlogCategories = async (req, res) => {
  try {
    const categories = await Blog.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 }, latest: { $max: "$publishedAt" } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, name: "$_id", count: 1, latest: 1 } },
    ]);
    res.json({ success: true, categories });
  } catch (error) {
    logger.error("Error listing blog categories", { error: error.message });
    res.status(500).json({ success: false, categories: [] });
  }
};

/**
 * GET /api/blogs/feed
 * Published posts WITH bodies — used by RSS and the llms-full.txt corpus.
 * Separate from the card list so a listing never drags full HTML.
 */
export const blogFeed = async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const blogs = await Blog.find({ status: "published" })
      .select(CARD_FIELDS + " content seo")
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, blogs });
  } catch (error) {
    logger.error("Error building blog feed", { error: error.message });
    res.status(500).json({ success: false, blogs: [] });
  }
};

/**
 * GET /api/blogs/:slug
 * A single published post, plus its related posts in one round trip so the
 * frontend renders the whole article page from one request.
 */
export const getBlogBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const blog = await Blog.findOne({ slug, status: "published" }).lean();

    if (!blog) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const related = await Blog.find({
      _id: { $ne: blog._id },
      status: "published",
      $or: [
        { category: blog.category },
        { tags: { $in: blog.tags && blog.tags.length ? blog.tags : ["__none__"] } },
      ],
    })
      .select(CARD_FIELDS)
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();

    res.json({ success: true, blog, related });
  } catch (error) {
    logger.error("Error fetching blog", { error: error.message, slug: req.params.slug });
    res.status(500).json({ success: false, message: "Failed to load post" });
  }
};

/**
 * POST /api/blogs/:slug/view
 * Fire-and-forget view counter. Always answers 200 so a failed telemetry
 * write can never surface as an error in the reader's browser.
 */
export const incrementBlogView = async (req, res) => {
  try {
    await Blog.updateOne(
      { slug: String(req.params.slug || "").toLowerCase(), status: "published" },
      { $inc: { views: 1 } }
    );
  } catch (error) {
    logger.warn("View increment failed", { error: error.message });
  }
  res.status(200).json({ success: true });
};

// ── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/blogs/admin/all — every post regardless of status. */
export const adminListBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status && ["draft", "published", "archived"].includes(req.query.status)) {
      query.status = req.query.status;
    }
    if (req.query.search) {
      const term = escapeRegex(String(req.query.search).slice(0, 80));
      query.$or = [{ title: new RegExp(term, "i") }, { slug: new RegExp(term, "i") }];
    }

    const [blogs, total, counts] = await Promise.all([
      Blog.find(query).select(CARD_FIELDS).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Blog.countDocuments(query),
      Blog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      blogs,
      counts: counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {
        draft: 0,
        published: 0,
        archived: 0,
      }),
      pagination: { currentPage: page, totalPages, totalBlogs: total, limit },
    });
  } catch (error) {
    logger.error("Error listing blogs (admin)", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load posts" });
  }
};

/** GET /api/blogs/admin/:id — full document for the editor. */
export const adminGetBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).lean();
    if (!blog) return res.status(404).json({ success: false, message: "Post not found" });
    res.json({ success: true, blog });
  } catch (error) {
    logger.error("Error fetching blog (admin)", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load post" });
  }
};

/** POST /api/blogs/admin — create a post. */
export const adminCreateBlog = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const safeContent = sanitizeRichText(content);
    if (!safeContent.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const status = ["draft", "published", "archived"].includes(req.body.status)
      ? req.body.status
      : "draft";
    const slug = await uniqueSlug(Blog, req.body.slug || title);

    let coverImage = req.body.coverImage || "";
    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      coverImage = await uploadImageFile(req.files.coverImage[0]);
    }

    const blog = await Blog.create({
      title: title.trim(),
      slug,
      excerpt: (req.body.excerpt || "").trim() || excerptOf(safeContent),
      content: safeContent,
      coverImage,
      coverImageAlt: (req.body.coverImageAlt || "").trim(),
      category: (req.body.category || "").trim() || "Insights",
      tags: parseList(req.body.tags),
      author: {
        name: (req.body.authorName || "").trim() || "Merlin Editorial",
        role: (req.body.authorRole || "").trim(),
        avatar: (req.body.authorAvatar || "").trim(),
        bio: (req.body.authorBio || "").trim().slice(0, 600),
      },
      status,
      publishedAt: status === "published" ? new Date() : null,
      featured: req.body.featured === "true" || req.body.featured === true,
      readingTime: readingTimeOf(safeContent),
      seo: {
        metaTitle: (req.body.metaTitle || "").trim(),
        metaDescription: (req.body.metaDescription || "").trim(),
        keywords: parseList(req.body.keywords),
        canonicalUrl: (req.body.canonicalUrl || "").trim(),
        noIndex: req.body.noIndex === "true" || req.body.noIndex === true,
      },
      createdBy: (req.admin && req.admin.email) || "",
    });

    await logAdminActivity(
      req.admin && req.admin.email,
      "blog_created",
      "blog",
      blog._id,
      blog.title,
      { status },
      req
    );
    if (status === "published") revalidateFrontend(pathsFor(blog)).catch(() => {});

    res.status(201).json({ success: true, message: "Post created", blog });
  } catch (error) {
    logger.error("Error creating blog", { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: "Failed to create post" });
  }
};

/** PUT /api/blogs/admin/:id — update a post. */
export const adminUpdateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: "Post not found" });

    const previousSlug = blog.slug;
    const previousCategory = blog.category;

    if (req.body.title && req.body.title.trim()) blog.title = req.body.title.trim();

    // A slug is only regenerated when the editor explicitly sends a new one —
    // never silently from a title edit, because published URLs are citations.
    if (req.body.slug && req.body.slug.trim() && slugify(req.body.slug) !== blog.slug) {
      blog.slug = await uniqueSlug(Blog, req.body.slug, blog._id);
    }

    if (typeof req.body.content === "string" && req.body.content.trim()) {
      const safeContent = sanitizeRichText(req.body.content);
      if (!safeContent.trim()) {
        return res.status(400).json({ success: false, message: "Content is required" });
      }
      blog.content = safeContent;
      blog.readingTime = readingTimeOf(safeContent);
    }

    if (typeof req.body.excerpt === "string") {
      blog.excerpt = req.body.excerpt.trim() || excerptOf(blog.content);
    }
    if (typeof req.body.category === "string" && req.body.category.trim()) {
      blog.category = req.body.category.trim();
    }
    if (typeof req.body.tags !== "undefined") blog.tags = parseList(req.body.tags);
    if (typeof req.body.coverImageAlt === "string") blog.coverImageAlt = req.body.coverImageAlt.trim();
    if (typeof req.body.coverImage === "string") blog.coverImage = req.body.coverImage;

    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      blog.coverImage = await uploadImageFile(req.files.coverImage[0]);
    }

    if (req.body.authorName && req.body.authorName.trim()) blog.author.name = req.body.authorName.trim();
    if (typeof req.body.authorRole === "string") blog.author.role = req.body.authorRole.trim();
    if (typeof req.body.authorAvatar === "string") blog.author.avatar = req.body.authorAvatar.trim();
    if (typeof req.body.authorBio === "string") blog.author.bio = req.body.authorBio.trim().slice(0, 600);

    if (typeof req.body.featured !== "undefined") {
      blog.featured = req.body.featured === "true" || req.body.featured === true;
    }

    if (["draft", "published", "archived"].includes(req.body.status)) {
      blog.status = req.body.status;
      // Stamp publishedAt once, on the first transition to published. Later
      // edits keep the original date so freshness signals stay honest.
      if (blog.status === "published" && !blog.publishedAt) blog.publishedAt = new Date();
    }

    if (typeof req.body.metaTitle === "string") blog.seo.metaTitle = req.body.metaTitle.trim();
    if (typeof req.body.metaDescription === "string") {
      blog.seo.metaDescription = req.body.metaDescription.trim();
    }
    if (typeof req.body.keywords !== "undefined") blog.seo.keywords = parseList(req.body.keywords);
    if (typeof req.body.canonicalUrl === "string") blog.seo.canonicalUrl = req.body.canonicalUrl.trim();
    if (typeof req.body.noIndex !== "undefined") {
      blog.seo.noIndex = req.body.noIndex === "true" || req.body.noIndex === true;
    }

    await blog.save();

    await logAdminActivity(
      req.admin && req.admin.email,
      "blog_updated",
      "blog",
      blog._id,
      blog.title,
      { status: blog.status },
      req
    );

    // Purge both the old and new URL when a slug or category moved, otherwise
    // the previous path keeps serving a stale page.
    revalidateFrontend([
      ...pathsFor(blog),
      previousSlug !== blog.slug ? "/blog/" + previousSlug : null,
      previousCategory !== blog.category ? "/blog/category/" + slugify(previousCategory) : null,
    ]).catch(() => {});

    res.json({ success: true, message: "Post updated", blog });
  } catch (error) {
    logger.error("Error updating blog", { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: "Failed to update post" });
  }
};

/** DELETE /api/blogs/admin/:id */
export const adminDeleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: "Post not found" });

    await logAdminActivity(
      req.admin && req.admin.email,
      "blog_deleted",
      "blog",
      blog._id,
      blog.title,
      {},
      req
    );
    revalidateFrontend(pathsFor(blog)).catch(() => {});

    res.json({ success: true, message: "Post deleted" });
  } catch (error) {
    logger.error("Error deleting blog", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to delete post" });
  }
};

/**
 * POST /api/blogs/admin/upload-image
 * Inline image upload for the rich-text editor. Returns a Cloudinary URL the
 * editor drops straight into the body.
 */
export const adminUploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No image provided" });
    const url = await uploadImageFile(req.file);
    res.json({ success: true, url });
  } catch (error) {
    logger.error("Error uploading blog image", { error: error.message });
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};
