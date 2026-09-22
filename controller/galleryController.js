import GalleryAlbum from '../models/galleryAlbumModel.js';
import { createContentController, clean, parseList, parseObject } from './contentController.js';

// The album list never ships `images` — an album can hold a hundred entries
// and the index page renders only the cover.
const LIST_FIELDS =
  'title slug description category location coverImage coverImageAlt status featured order createdAt updatedAt';

const controller = createContentController({
  Model: GalleryAlbum,
  label: 'gallery album',
  targetType: 'gallery',
  folder: 'gallery',
  listFields: LIST_FIELDS,
  defaultSort: { order: 1, createdAt: -1 },

  publicQuery: (req) => {
    const query = {};
    if (req.query.category && req.query.category !== 'all') {
      query.category = new RegExp(
        '^' + String(req.query.category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
        'i'
      );
    }
    return query;
  },

  assign: (doc, body, uploads) => {
    if (body.title !== undefined) doc.title = clean(body.title, 200);
    if (body.description !== undefined) doc.description = clean(body.description, 1000);
    if (body.category !== undefined) doc.category = clean(body.category, 120);
    if (body.location !== undefined) doc.location = clean(body.location, 200);

    if (uploads.coverImage) doc.coverImage = uploads.coverImage.url;
    else if (body.coverImage !== undefined) doc.coverImage = clean(body.coverImage, 500);
    if (body.coverImageAlt !== undefined) doc.coverImageAlt = clean(body.coverImageAlt, 250);

    // Existing images arrive as JSON (so alt text and order survive an edit);
    // new files arrive through multer and are appended.
    if (body.images !== undefined || uploads.imagesList) {
      const kept = parseList(body.images)
        .map((entry) => (typeof entry === 'string' ? { url: entry } : entry))
        .filter((img) => img && img.url)
        .map((img, index) => ({
          url: String(img.url),
          alt: clean(img.alt, 250),
          caption: clean(img.caption, 300),
          width: parseInt(img.width, 10) || 0,
          height: parseInt(img.height, 10) || 0,
          order: Number.isFinite(img.order) ? img.order : index,
        }));

      // Cloudinary returns real dimensions on upload, so every new image gets
      // an aspect ratio the frontend can reserve space with. That is the
      // difference between a gallery that loads calmly and one that jumps.
      const added = (uploads.imagesList || []).map((img, index) => ({
        url: img.url,
        alt: '',
        caption: '',
        width: img.width || 0,
        height: img.height || 0,
        order: kept.length + index,
      }));

      doc.images = [...kept, ...added];
    }

    // An album with no cover borrows its first photograph rather than
    // rendering an empty tile.
    if (!doc.coverImage && doc.images?.length) doc.coverImage = doc.images[0].url;

    if (body.status !== undefined) doc.status = clean(body.status, 20);
    if (body.featured !== undefined) doc.featured = body.featured === true || body.featured === 'true';
    if (body.order !== undefined) doc.order = parseInt(body.order, 10) || 0;

    const seo = parseObject(body.seo);
    if (Object.keys(seo).length) {
      doc.seo = {
        metaTitle: clean(seo.metaTitle, 200),
        metaDescription: clean(seo.metaDescription, 400),
        noIndex: seo.noIndex === true || seo.noIndex === 'true',
      };
    }
  },

  paths: (doc) => ['/gallery', '/archive', `/gallery/${doc.slug}`],
});

export const listAlbums = controller.list;
export const listAlbumSlugs = controller.listSlugs;
export const getAlbumBySlug = controller.getBySlug;
export const adminListAlbums = controller.adminList;
export const adminGetAlbum = controller.adminGet;
export const adminCreateAlbum = controller.adminCreate;
export const adminUpdateAlbum = controller.adminUpdate;
export const adminDeleteAlbum = controller.adminDelete;
export const adminUploadGalleryImage = controller.adminUploadImage;
