import express from "express";
import {
  getSiteContent,
  listSiteContent,
  adminListSiteContent,
  adminGetSiteContent,
  adminSaveSiteContent,
  adminUploadSiteImage,
} from "../controller/siteContentController.js";
import { adminProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// Admin routes are registered first, or `/admin/all` would be read as a
// content key by `GET /:key` below.
router.get("/admin/all", adminProtect, adminListSiteContent);
router.post("/admin/upload-image", adminProtect, upload.single("image"), adminUploadSiteImage);
router.get("/admin/:key", adminProtect, adminGetSiteContent);
router.put("/admin/:key", adminProtect, adminSaveSiteContent);

router.get("/", listSiteContent);
router.get("/:key", getSiteContent);

export default router;
