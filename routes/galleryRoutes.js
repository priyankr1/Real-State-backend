import express from "express";
import {
  listAlbums,
  listAlbumSlugs,
  getAlbumBySlug,
  adminListAlbums,
  adminGetAlbum,
  adminCreateAlbum,
  adminUpdateAlbum,
  adminDeleteAlbum,
  adminUploadGalleryImage,
} from "../controller/galleryController.js";
import { adminProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

const files = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

router.get("/admin/all", adminProtect, adminListAlbums);
router.post("/admin/upload-image", adminProtect, upload.single("image"), adminUploadGalleryImage);
router.post("/admin", adminProtect, files, adminCreateAlbum);
router.get("/admin/:id", adminProtect, adminGetAlbum);
router.put("/admin/:id", adminProtect, files, adminUpdateAlbum);
router.delete("/admin/:id", adminProtect, adminDeleteAlbum);

router.get("/slugs", listAlbumSlugs);
router.get("/", listAlbums);
router.get("/:slug", getAlbumBySlug);

export default router;
