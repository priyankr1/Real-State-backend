import express from 'express';
import {
    createUserListing,
    getUserListings,
    updateUserListing,
    deleteUserListing,
} from '../controller/propertyController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/multer.js';

const router = express.Router();

router.post('/user/properties', protect, upload.array('images', 4), createUserListing);
router.get('/user/properties', protect, getUserListings);
router.put('/user/properties/:id', protect, upload.array('images', 4), updateUserListing);
router.delete('/user/properties/:id', protect, deleteUserListing);

export default router;
