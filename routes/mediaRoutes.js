import express from "express";
import {
  listMedia,
  listMediaSlugs,
  getMediaBySlug,
  adminListMedia,
  adminGetMedia,
  adminCreateMedia,
  adminUpdateMedia,
  adminDeleteMedia,
  adminUploadMediaImage,
} from "../controller/mediaController.js";
import { adminProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

const files = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

// Admin first — otherwise /admin/all is parsed as the slug "admin".
router.get("/admin/all", adminProtect, adminListMedia);
router.post("/admin/upload-image", adminProtect, upload.single("image"), adminUploadMediaImage);
router.post("/admin", adminProtect, files, adminCreateMedia);
router.get("/admin/:id", adminProtect, adminGetMedia);
router.put("/admin/:id", adminProtect, files, adminUpdateMedia);
router.delete("/admin/:id", adminProtect, adminDeleteMedia);

router.get("/slugs", listMediaSlugs);
router.get("/", listMedia);
router.get("/:slug", getMediaBySlug);

export default router;
