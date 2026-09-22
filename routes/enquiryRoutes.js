import express from 'express';
import {
  submitEnquiry,
  adminListEnquiries,
  adminEnquiryStats,
  adminExportEnquiries,
  adminGetEnquiry,
  adminUpdateEnquiry,
  adminResyncEnquiry,
  adminDeleteEnquiry,
} from '../controller/enquiryController.js';
import { adminProtect } from '../middleware/authMiddleware.js';
import { enquiryLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// ── Admin ───────────────────────────────────────────────────────────────────
// Registered before "/:id" so /admin/stats is never read as an enquiry id.
router.get('/admin/all', adminProtect, adminListEnquiries);
router.get('/admin/stats', adminProtect, adminEnquiryStats);
router.get('/admin/export', adminProtect, adminExportEnquiries);
router.get('/admin/:id', adminProtect, adminGetEnquiry);
router.put('/admin/:id', adminProtect, adminUpdateEnquiry);
router.post('/admin/:id/resync', adminProtect, adminResyncEnquiry);
router.delete('/admin/:id', adminProtect, adminDeleteEnquiry);

// ── Public ──────────────────────────────────────────────────────────────────
router.post('/', enquiryLimiter, submitEnquiry);
// The pre-existing contact form posts to /submit. Kept so an older cached
// bundle in someone's browser keeps working through a deploy.
router.post('/submit', enquiryLimiter, submitEnquiry);

export default router;
