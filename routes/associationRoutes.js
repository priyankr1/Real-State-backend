import express from "express";
import {
  listAssociations,
  getAssociationBySlug,
  adminListAssociations,
  adminGetAssociation,
  adminCreateAssociation,
  adminUpdateAssociation,
  adminDeleteAssociation,
  adminUploadAssociationLogo,
} from "../controller/associationController.js";
import { adminProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

const files = upload.fields([{ name: "logo", maxCount: 1 }]);

router.get("/admin/all", adminProtect, adminListAssociations);
router.post("/admin/upload-image", adminProtect, upload.single("image"), adminUploadAssociationLogo);
router.post("/admin", adminProtect, files, adminCreateAssociation);
router.get("/admin/:id", adminProtect, adminGetAssociation);
router.put("/admin/:id", adminProtect, files, adminUpdateAssociation);
router.delete("/admin/:id", adminProtect, adminDeleteAssociation);

router.get("/", listAssociations);
router.get("/:slug", getAssociationBySlug);

export default router;
