import express from "express";
import {
  // public
  listBlogs,
  listBlogSlugs,
  listBlogCategories,
  blogFeed,
  getBlogBySlug,
  incrementBlogView,
  // admin
  adminListBlogs,
  adminGetBlog,
  adminCreateBlog,
  adminUpdateBlog,
  adminDeleteBlog,
  adminUploadImage,
} from "../controller/blogController.js";
import { adminProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// ── Admin routes first ──────────────────────────────────────────────────────
// These must be registered before the "/:slug" catch-all, otherwise a request
// for /api/blogs/admin/all would be read as a post with the slug "admin".
router.get("/admin/all", adminProtect, adminListBlogs);
router.post("/admin/upload-image", adminProtect, upload.single("image"), adminUploadImage);
router.post("/admin", adminProtect, upload.fields([{ name: "coverImage", maxCount: 1 }]), adminCreateBlog);
router.get("/admin/:id", adminProtect, adminGetBlog);
router.put("/admin/:id", adminProtect, upload.fields([{ name: "coverImage", maxCount: 1 }]), adminUpdateBlog);
router.delete("/admin/:id", adminProtect, adminDeleteBlog);

// ── Public routes ───────────────────────────────────────────────────────────
// Fixed segments before the slug parameter, for the same reason.
router.get("/slugs", listBlogSlugs);
router.get("/categories", listBlogCategories);
router.get("/feed", blogFeed);
router.get("/", listBlogs);
router.post("/:slug/view", incrementBlogView);
router.get("/:slug", getBlogBySlug);

export default router;
