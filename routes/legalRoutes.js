import express from "express";
import {
  getLegalPage,
  listLegalPages,
  adminListLegalPages,
  adminGetLegalPage,
  adminSaveLegalPage,
} from "../controller/legalPageController.js";
import { adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/admin/all", adminProtect, adminListLegalPages);
router.get("/admin/:key", adminProtect, adminGetLegalPage);
router.put("/admin/:key", adminProtect, adminSaveLegalPage);

router.get("/", listLegalPages);
router.get("/:key", getLegalPage);

export default router;
