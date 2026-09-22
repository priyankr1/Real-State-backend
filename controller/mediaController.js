import MediaItem from '../models/mediaItemModel.js';
import { createContentController, clean, parseList, parseObject } from './contentController.js';

const LIST_FIELDS =
  'kind title slug summary date coverImage coverImageAlt publication externalUrl location category status featured order createdAt updatedAt';

/**
 * Merges the image set an editor submitted with anything newly uploaded.
 *
 * The client sends the full current list (so removals and caption edits are
 * expressed by omission and by value), and multer delivers the new files
 * separately. Appending rather than replacing means a slow upload can never
 * wipe an existing set.
 */
const mergeImages = (existing, body, uploads) => {
  const submitted = parseList(body.images)
    .map((entry) => (typeof entry === 'string' ? { url: entry } : entry))
    .filter((img) => img && img.url)
    .map((img) => ({
      url: String(img.url),
      alt: clean(img.alt, 250),
      caption: clean(img.caption, 300),
    }));

  const added = (uploads.imagesList || []).map((img) => ({
    url: img.url,
    alt: '',
    caption: '',
  }));

  // No `images` key at all means "leave them alone" — a partial update from a
  // form that does not manage images must not delete them.
  const base = body.images === undefined ? existing || [] : submitted;
  return [...base, ...added];
};

const controller = createContentController({
  Model: MediaItem,
  label: 'media item',
  targetType: 'media',
  folder: 'media',
  listFields: LIST_FIELDS,
  defaultSort: { order: 1, date: -1 },
  richTextFields: ['content'],

  publicQuery: (req) => {
    const query = {};
    if (req.query.kind && req.query.kind !== 'all') query.kind = req.query.kind;
    if (req.query.year) {
      const year = parseInt(req.query.year, 10);
      if (year) {
        query.date = {
          $gte: new Date(Date.UTC(year, 0, 1)),
          $lt: new Date(Date.UTC(year + 1, 0, 1)),
        };
      }
    }
    return query;
  },

  assign: (doc, body, uploads) => {
    if (body.kind) doc.kind = clean(body.kind, 20);
    if (!doc.kind) doc.kind = 'media';

    if (body.title !== undefined) doc.title = clean(body.title, 250);
    if (body.summary !== undefined) doc.summary = clean(body.summary, 500);
    if (body.date !== undefined && !Number.isNaN(Date.parse(body.date))) {
      doc.date = new Date(body.date);
    }
    if (!doc.date) doc.date = new Date();

    if (body.publication !== undefined) doc.publication = clean(body.publication, 200);
    if (body.externalUrl !== undefined) doc.externalUrl = clean(body.externalUrl, 500);
    if (body.location !== undefined) doc.location = clean(body.location, 250);
    if (body.category !== undefined) doc.category = clean(body.category, 200);

    if (uploads.coverImage) doc.coverImage = uploads.coverImage.url;
    else if (body.coverImage !== undefined) doc.coverImage = clean(body.coverImage, 500);
    if (body.coverImageAlt !== undefined) doc.coverImageAlt = clean(body.coverImageAlt, 250);

    doc.images = mergeImages(doc.images, body, uploads);

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

  paths: (doc) => ['/media', '/archive', `/media/${doc.slug}`, '/'],
});

export const listMedia = controller.list;
export const listMediaSlugs = controller.listSlugs;
export const getMediaBySlug = controller.getBySlug;
export const adminListMedia = controller.adminList;
export const adminGetMedia = controller.adminGet;
export const adminCreateMedia = controller.adminCreate;
export const adminUpdateMedia = controller.adminUpdate;
export const adminDeleteMedia = controller.adminDelete;
export const adminUploadMediaImage = controller.adminUploadImage;
