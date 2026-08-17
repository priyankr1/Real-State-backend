import fs from 'fs';
import cloudinary from '../config/cloudinary.js';
import Property from '../models/propertyModel.js';
import logger from '../utils/logger.js';

const EXPIRY_DAYS = 45;

/**
 * Upload files in req.files (from multer array) to Cloudinary.
 * Returns an array of public URLs.
 * Deletes each temp file after uploading.
 */
async function uploadImages(files) {
    return Promise.all(
        files.map(async (file) => {
            try {
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: 'buildestate/properties',
                    resource_type: 'image',
                });
                return result.secure_url;
            } finally {
                fs.unlink(file.path, (err) => {
                    if (err) logger.warn("Error deleting temp file", { error: err?.message });
                });
            }
        })
    );
}

/** POST /api/user/properties â€” create a new listing (pending approval) */
export const createUserListing = async (req, res) => {
    try {
        const { title, location, price, beds, baths, sqft, type, availability, description, phone, googleMapLink } = req.body;

        // Parse amenities â€” frontend sends as JSON string in FormData
        let amenities = [];
        try {
            amenities = req.body.amenities ? JSON.parse(req.body.amenities) : [];
        } catch {
            amenities = Array.isArray(req.body.amenities) ? req.body.amenities : [];
        }

        // Required field validation
        const missing = ['title', 'location', 'price', 'beds', 'baths', 'sqft', 'type', 'availability', 'description', 'phone']
            .filter((f) => !req.body[f]);
        if (missing.length) {
            return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
        }

        const files = req.files || [];
        if (files.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one image is required' });
        }

        const imageUrls = await uploadImages(files);

        const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        const property = await Property.create({
            title,
            location,
            price: Number(price),
            beds: Number(beds),
            baths: Number(baths),
            sqft: Number(sqft),
            type,
            availability,
            description,
            amenities,
            image: imageUrls,
            phone,
            googleMapLink: googleMapLink || '',
            status: 'pending',
            postedBy: req.user._id,
            expiresAt,
        });

        res.status(201).json({ success: true, message: 'Listing submitted for review', property });
    } catch (error) {
        logger.error("Error creating user listing", { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Failed to create listing', error: error.message });
    }
};

/** GET /api/user/properties â€” get all listings by the logged-in user */
export const getUserListings = async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default 10 per page for user listings
        const skip = (page - 1) * limit;

        const query = { postedBy: req.user._id };

        // Get total count for pagination metadata
        const totalProperties = await Property.countDocuments(query);
        const totalPages = Math.ceil(totalProperties / limit);

        // Get properties with pagination
        const properties = await Property.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        res.json({
            success: true,
            properties,
            pagination: {
                currentPage: page,
                totalPages,
                totalProperties,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                limit
            }
        });
    } catch (error) {
        logger.error("Error fetching user listings", { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Failed to fetch listings', error: error.message });
    }
};

/** PUT /api/user/properties/:id â€” edit an owned listing (resets to pending) */
export const updateUserListing = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }

        if (!property.postedBy || property.postedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorised to edit this listing' });
        }

        const { title, location, price, beds, baths, sqft, type, availability, description, phone, googleMapLink } = req.body;

        let amenities = property.amenities;
        if (req.body.amenities) {
            try {
                amenities = JSON.parse(req.body.amenities);
            } catch {
                amenities = Array.isArray(req.body.amenities) ? req.body.amenities : property.amenities;
            }
        }

        // If new images uploaded, replace the existing set
        let imageUrls = property.image;
        const files = req.files || [];
        if (files.length > 0) {
            imageUrls = await uploadImages(files);
        }

        const updates = {
            ...(title && { title }),
            ...(location && { location }),
            ...(price && { price: Number(price) }),
            ...(beds && { beds: Number(beds) }),
            ...(baths && { baths: Number(baths) }),
            ...(sqft && { sqft: Number(sqft) }),
            ...(type && { type }),
            ...(availability && { availability }),
            ...(description && { description }),
            ...(phone && { phone }),
            googleMapLink: googleMapLink ?? property.googleMapLink,
            amenities,
            image: imageUrls,
            // Any edit resets to pending so admin re-reviews
            status: 'pending',
            rejectionReason: '',
        };

        const updated = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json({ success: true, message: 'Listing updated and resubmitted for review', property: updated });
    } catch (error) {
        logger.error("Error updating user listing", { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Failed to update listing', error: error.message });
    }
};

/** DELETE /api/user/properties/:id â€” delete an owned listing */
export const deleteUserListing = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }

        if (!property.postedBy || property.postedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorised to delete this listing' });
        }

        await Property.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Listing deleted successfully' });
    } catch (error) {
        logger.error("Error deleting user listing", { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Failed to delete listing', error: error.message });
    }
};
