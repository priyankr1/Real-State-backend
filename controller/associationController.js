import Association from '../models/associationModel.js';
import { createContentController, clean } from './contentController.js';

const LIST_FIELDS =
  'name slug category categoryLabel logo logoAlt description website since status featured order createdAt updatedAt';

const controller = createContentController({
  Model: Association,
  label: 'association',
  targetType: 'association',
  folder: 'associations',
  listFields: LIST_FIELDS,
  defaultSort: { order: 1, name: 1 },

  publicQuery: (req) => {
    const query = {};
    if (req.query.category && req.query.category !== 'all') {
      query.category = clean(req.query.category, 40);
    }
    return query;
  },

  assign: (doc, body, uploads) => {
    // The model's title field is `name`; the factory slugs from title||name.
    if (body.name !== undefined) doc.name = clean(body.name, 200);
    if (body.title !== undefined && !body.name) doc.name = clean(body.title, 200);

    if (body.category !== undefined) doc.category = clean(body.category, 40);
    if (body.categoryLabel !== undefined) doc.categoryLabel = clean(body.categoryLabel, 120);
    if (body.description !== undefined) doc.description = clean(body.description, 2000);
    if (body.website !== undefined) doc.website = clean(body.website, 500);
    if (body.since !== undefined) doc.since = parseInt(body.since, 10) || null;

    // `logo` is this resource's cover image; the admin form may post it under
    // either name depending on which uploader it used.
    if (uploads.logo) doc.logo = uploads.logo.url;
    else if (uploads.coverImage) doc.logo = uploads.coverImage.url;
    else if (body.logo !== undefined) doc.logo = clean(body.logo, 500);
    if (body.logoAlt !== undefined) doc.logoAlt = clean(body.logoAlt, 250);

    // A logo with no alt text is invisible to a screen reader and to an image
    // crawler. The organisation's own name is always a correct fallback.
    if (!doc.logoAlt && doc.name) doc.logoAlt = `${doc.name} logo`;

    if (body.status !== undefined) doc.status = clean(body.status, 20);
    if (body.featured !== undefined) doc.featured = body.featured === true || body.featured === 'true';
    if (body.order !== undefined) doc.order = parseInt(body.order, 10) || 0;
  },

  paths: () => ['/corporate-association', '/archive'],
});

export const listAssociations = controller.list;
export const getAssociationBySlug = controller.getBySlug;
export const adminListAssociations = controller.adminList;
export const adminGetAssociation = controller.adminGet;
export const adminCreateAssociation = controller.adminCreate;
export const adminUpdateAssociation = controller.adminUpdate;
export const adminDeleteAssociation = controller.adminDelete;
export const adminUploadAssociationLogo = controller.adminUploadImage;
