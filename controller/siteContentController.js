import SiteContent from '../models/siteContentModel.js';
import logger from '../utils/logger.js';
import { sanitizeRichText } from '../utils/sanitizeHtml.js';
import { revalidateFrontend } from '../utils/revalidateFrontend.js';
import { logAdminActivity } from '../utils/activityLogger.js';
import { clean, parseList, parseObject, uploadImageFile } from './contentController.js';

/**
 * Home, About Us and the site-wide chrome.
 *
 * Deliberately not run through `createContentController`: that factory is for
 * collections — many rows, one shape, slugs and ordering. These are singletons
 * with three different nested shapes and no slug at all. Same call as
 * `legalPageController` made, for the same reason.
 *
 * The one rule that matters here: **nothing is stored that was not rebuilt
 * field by field.** The model's `data` is `Mixed`, so a `Object.assign(doc.data,
 * req.body)` would let an editor — or anyone who got hold of an admin token —
 * write arbitrary keys into a document the homepage renders. Every normalizer
 * below constructs a fresh object from an allowlist and drops the rest.
 */

const KEYS = ['home', 'about', 'settings'];

const LABELS = {
  home: 'Home page',
  about: 'About Us page',
  settings: 'Site-wide settings',
};

/** Which ISR paths a change to each key invalidates. */
const PATHS = {
  home: ['/', '/archive'],
  about: ['/about', '/archive'],
  // Settings drive the nav, footer and schema graph, which are on every page.
  // Next has no "purge everything" call, so the routes that matter are listed.
  settings: ['/', '/about', '/properties', '/blog', '/media', '/gallery', '/corporate-association', '/contact', '/archive'],
};

// ── Field helpers ───────────────────────────────────────────────────────────

const text = (value, max = 300) => clean(value, max);

/** Long-form plain text: intros, quotes, bios. Not HTML — tags are stripped by `clean`'s consumer. */
const longText = (value, max = 2000) => clean(value, max);

/** A relative path or absolute URL to an image. Anything else becomes ''. */
const imagePath = (value) => {
  const raw = clean(value, 600);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
  return '';
};

/** An internal path or absolute URL. Blocks `javascript:` and friends. */
const link = (value) => {
  const raw = clean(value, 600);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('#')) return raw;
  return '';
};

const cta = (value) => {
  const source = parseObject(value);
  return { label: text(source.label, 80), href: link(source.href) };
};

/** Maps an array field with a per-item normalizer, dropping anything falsy. */
const list = (value, fn, max = 60) => {
  const source = Array.isArray(value) ? value : parseList(value);
  if (!Array.isArray(source)) return [];
  return source.slice(0, max).map(fn).filter(Boolean);
};

const stringList = (value, max = 40, len = 160) =>
  list(value, (item) => text(item, len), max);

const seoBlock = (value) => {
  const source = parseObject(value);
  return {
    metaTitle: text(source.metaTitle, 200),
    metaDescription: text(source.metaDescription, 400),
    keywords: stringList(source.keywords, 30, 120),
  };
};

const statItem = (value) => {
  const source = parseObject(value);
  const label = text(source.label, 160);
  const val = text(source.value, 40);
  if (!label && !val) return null;
  return {
    value: val,
    suffix: text(source.suffix, 40),
    label,
    icon: imagePath(source.icon),
  };
};

const imageItem = (value) => {
  const source = parseObject(value);
  const url = imagePath(source.url ?? source.image);
  if (!url) return null;
  return { url, alt: text(source.alt, 250), caption: text(source.caption, 250) };
};

// ── Per-key normalizers ─────────────────────────────────────────────────────

const normalizeHome = (body) => {
  const hero = parseObject(body.hero);
  const positioning = parseObject(body.positioning);
  const stats = parseObject(body.stats);
  const leadership = parseObject(body.leadership);
  const showcase = parseObject(body.showcase);
  const projects = parseObject(body.projects);
  const testimonials = parseObject(body.testimonials);
  const journal = parseObject(body.journal);
  const enquiry = parseObject(body.enquiry);

  return {
    seo: seoBlock(body.seo),

    hero: {
      kicker: text(hero.kicker, 120),
      headline: text(hero.headline, 200),
      // The headline is the h1 and the LCP element. Editors want a line break
      // in it; storing the break as an array rather than "\n" or a <br> keeps
      // the value safe to render in both HTML and a plain-text meta tag.
      headlineLines: stringList(hero.headlineLines, 4, 120),
      subheadline: longText(hero.subheadline, 600),
      primaryCta: cta(hero.primaryCta),
      secondaryCta: cta(hero.secondaryCta),
      image: imagePath(hero.image),
      imageAlt: text(hero.imageAlt, 250),
      mobileImage: imagePath(hero.mobileImage),
      videoUrl: link(hero.videoUrl),
      scrollLabel: text(hero.scrollLabel, 40),
    },

    positioning: {
      kicker: text(positioning.kicker, 120),
      heading: text(positioning.heading, 200),
      intro: longText(positioning.intro, 800),
      pillars: list(positioning.pillars, (item) => {
        const pillar = parseObject(item);
        const title = text(pillar.title, 120);
        if (!title) return null;
        return {
          title,
          description: longText(pillar.description, 600),
          image: imagePath(pillar.image),
          imageAlt: text(pillar.imageAlt, 250),
        };
      }, 12),
    },

    stats: {
      kicker: text(stats.kicker, 120),
      heading: text(stats.heading, 200),
      items: list(stats.items, statItem, 12),
    },

    leadership: {
      kicker: text(leadership.kicker, 120),
      heading: text(leadership.heading, 200),
      items: list(leadership.items, (item) => {
        const person = parseObject(item);
        const name = text(person.name, 160);
        if (!name) return null;
        return {
          eyebrow: text(person.eyebrow, 120),
          name,
          designation: text(person.designation, 160),
          quote: longText(person.quote, 800),
          image: imagePath(person.image),
          mobileImage: imagePath(person.mobileImage),
          imageAlt: text(person.imageAlt, 250),
        };
      }, 12),
    },

    showcase: {
      kicker: text(showcase.kicker, 120),
      heading: text(showcase.heading, 200),
      items: list(showcase.items, (item) => {
        const entry = parseObject(item);
        const image = imagePath(entry.image);
        if (!image) return null;
        return { name: text(entry.name, 160), image, imageAlt: text(entry.imageAlt, 250) };
      }, 20),
    },

    projects: {
      kicker: text(projects.kicker, 120),
      heading: text(projects.heading, 200),
      intro: longText(projects.intro, 800),
      ctaLabel: text(projects.ctaLabel, 80),
      ctaHref: link(projects.ctaHref),
      enquireLabel: text(projects.enquireLabel, 40),
      filters: list(projects.filters, (item) => {
        const filter = parseObject(item);
        const label = text(filter.label, 80);
        if (!label) return null;
        return { label, value: text(filter.value, 80) };
      }, 10),
      items: list(projects.items, (item) => {
        const project = parseObject(item);
        const name = text(project.name, 160);
        if (!name) return null;
        return {
          name,
          location: text(project.location, 200),
          possession: text(project.possession, 120),
          category: text(project.category, 80),
          image: imagePath(project.image),
          mobileImage: imagePath(project.mobileImage),
          imageAlt: text(project.imageAlt, 250),
          href: link(project.href),
        };
      }, 40),
    },

    testimonials: {
      kicker: text(testimonials.kicker, 120),
      heading: text(testimonials.heading, 200),
      ctaLabel: text(testimonials.ctaLabel, 80),
      ctaHref: link(testimonials.ctaHref),
      items: list(testimonials.items, (item) => {
        const entry = parseObject(item);
        const quote = longText(entry.quote, 1200);
        if (!quote) return null;
        return {
          quote,
          name: text(entry.name, 160),
          project: text(entry.project, 200),
          image: imagePath(entry.image),
          imageAlt: text(entry.imageAlt, 250),
        };
      }, 20),
    },

    journal: {
      kicker: text(journal.kicker, 120),
      heading: text(journal.heading, 200),
      ctaLabel: text(journal.ctaLabel, 80),
      ctaHref: link(journal.ctaHref),
      limit: Math.min(12, Math.max(0, parseInt(journal.limit, 10) || 3)),
    },

    enquiry: {
      kicker: text(enquiry.kicker, 120),
      heading: text(enquiry.heading, 200),
      intro: longText(enquiry.intro, 800),
      promise: text(enquiry.promise, 200),
    },
  };
};

const normalizeAbout = (body) => {
  const hero = parseObject(body.hero);
  const profile = parseObject(body.profile);
  const vision = parseObject(body.vision);
  const mission = parseObject(body.mission);
  const values = parseObject(body.values);
  const stats = parseObject(body.stats);
  const milestones = parseObject(body.milestones);
  const leadership = parseObject(body.leadership);
  const team = parseObject(body.team);
  const ctaBlock = parseObject(body.cta);

  return {
    seo: seoBlock(body.seo),

    hero: {
      kicker: text(hero.kicker, 120),
      headline: text(hero.headline, 200),
      intro: longText(hero.intro, 800),
      image: imagePath(hero.image),
      imageAlt: text(hero.imageAlt, 250),
    },

    profile: {
      heading: text(profile.heading, 200),
      // The one rich-text field on this page. Sanitized here, at the write
      // boundary, so every consumer — page, llms-full.txt, RSS — inherits the
      // guarantee rather than each remembering to escape.
      body: sanitizeRichText(String(profile.body ?? '')),
      image: imagePath(profile.image),
      imageAlt: text(profile.imageAlt, 250),
    },

    vision: { heading: text(vision.heading, 200), body: longText(vision.body, 1500) },
    mission: { heading: text(mission.heading, 200), body: longText(mission.body, 1500) },

    values: {
      heading: text(values.heading, 200),
      items: list(values.items, (item) => {
        const entry = parseObject(item);
        const title = text(entry.title, 160);
        if (!title) return null;
        return {
          title,
          description: longText(entry.description, 600),
          image: imagePath(entry.image),
          imageAlt: text(entry.imageAlt, 250),
        };
      }, 12),
    },

    stats: {
      heading: text(stats.heading, 200),
      items: list(stats.items, statItem, 12),
    },

    milestones: {
      heading: text(milestones.heading, 200),
      intro: longText(milestones.intro, 600),
      note: text(milestones.note, 300),
      items: list(milestones.items, (item) => {
        const entry = parseObject(item);
        const year = text(entry.year, 40);
        const title = text(entry.title, 200);
        if (!year && !title) return null;
        return { year, title, description: longText(entry.description, 800) };
      }, 60),
    },

    leadership: {
      heading: text(leadership.heading, 200),
      intro: longText(leadership.intro, 600),
      items: list(leadership.items, (item) => {
        const person = parseObject(item);
        const name = text(person.name, 160);
        if (!name) return null;
        return {
          name,
          designation: text(person.designation, 160),
          bio: longText(person.bio, 2000),
          quote: longText(person.quote, 800),
          image: imagePath(person.image),
          imageAlt: text(person.imageAlt, 250),
          linkedin: link(person.linkedin),
        };
      }, 40),
    },

    team: {
      heading: text(team.heading, 200),
      intro: longText(team.intro, 600),
      images: list(team.images, imageItem, 40),
    },

    cta: {
      heading: text(ctaBlock.heading, 200),
      body: longText(ctaBlock.body, 800),
      ctaLabel: text(ctaBlock.ctaLabel, 80),
      ctaHref: link(ctaBlock.ctaHref),
    },
  };
};

const normalizeSettings = (body) => {
  const brand = parseObject(body.brand);
  const contact = parseObject(body.contact);
  const navigation = parseObject(body.navigation);
  const footer = parseObject(body.footer);
  const enquiryForm = parseObject(body.enquiryForm);
  const seo = parseObject(body.seo);

  const navLink = (item) => {
    const entry = parseObject(item);
    const label = text(entry.label, 120);
    const href = link(entry.href);
    if (!label || !href) return null;
    return { label, href };
  };

  return {
    brand: {
      name: text(brand.name, 120),
      legalName: text(brand.legalName, 200),
      tagline: text(brand.tagline, 200),
      logoLight: imagePath(brand.logoLight),
      logoDark: imagePath(brand.logoDark),
      logoSvg: imagePath(brand.logoSvg),
      colors: list(brand.colors, (item) => {
        const entry = parseObject(item);
        const hex = text(entry.hex, 32);
        // A colour that is not a colour ends up as a CSS custom property and
        // silently breaks a theme, so it is rejected rather than stored.
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
        return { name: text(entry.name, 80), hex };
      }, 24),
      fonts: list(brand.fonts, (item) => {
        const entry = parseObject(item);
        const family = text(entry.family, 120);
        if (!family) return null;
        return { role: text(entry.role, 80), family };
      }, 12),
      guidelinesUrl: link(brand.guidelinesUrl),
      note: text(brand.note, 500),
    },

    contact: {
      officeName: text(contact.officeName, 120),
      companyName: text(contact.companyName, 200),
      addressLines: stringList(contact.addressLines, 8, 200),
      registeredAddressLines: stringList(contact.registeredAddressLines, 8, 200),
      locality: text(contact.locality, 120),
      region: text(contact.region, 120),
      postalCode: text(contact.postalCode, 20),
      country: text(contact.country, 4),
      phone: text(contact.phone, 32),
      phoneDisplay: text(contact.phoneDisplay, 60),
      email: text(contact.email, 200),
      whatsapp: link(contact.whatsapp),
      hours: text(contact.hours, 200),
    },

    social: list(body.social, (item) => {
      const entry = parseObject(item);
      const url = link(entry.url);
      if (!url) return null;
      return { platform: text(entry.platform, 60), url };
    }, 20),

    navigation: {
      primary: list(navigation.primary, (item) => {
        const entry = parseObject(item);
        const label = text(entry.label, 120);
        if (!label) return null;
        return {
          label,
          href: link(entry.href),
          children: list(entry.children, navLink, 20),
        };
      }, 12),
      footer: list(navigation.footer, (item) => {
        const group = parseObject(item);
        const heading = text(group.heading, 120);
        const links = list(group.links, navLink, 20);
        if (!heading && !links.length) return null;
        return { heading, links };
      }, 8),
    },

    footer: {
      note: text(footer.note, 400),
      copyright: text(footer.copyright, 300),
      credit: text(footer.credit, 300),
    },

    enquiryForm: {
      heading: text(enquiryForm.heading, 200),
      submitLabel: text(enquiryForm.submitLabel, 60),
      successMessage: text(enquiryForm.successMessage, 400),
      // Consent wording is a compliance artefact, not decoration: what a lead
      // agreed to is only defensible if the exact text is recorded.
      consentText: longText(enquiryForm.consentText, 1200),
      destinationEmails: stringList(enquiryForm.destinationEmails, 10, 200),
      fields: list(enquiryForm.fields, (item) => {
        const field = parseObject(item);
        const name = text(field.name, 60).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!name) return null;
        return {
          name,
          label: text(field.label, 160),
          type: ['text', 'email', 'tel', 'select', 'textarea', 'checkbox', 'date'].includes(field.type)
            ? field.type
            : 'text',
          required: field.required === true || field.required === 'true',
          options: stringList(field.options, 100, 160),
        };
      }, 30),
    },

    seo: {
      defaultMetaTitle: text(seo.defaultMetaTitle, 200),
      defaultMetaDescription: text(seo.defaultMetaDescription, 400),
      keywords: stringList(seo.keywords, 40, 120),
      areaServed: stringList(seo.areaServed, 30, 120),
      pages: list(seo.pages, (item) => {
        const page = parseObject(item);
        const path = link(page.path);
        if (!path) return null;
        return {
          path,
          metaTitle: text(page.metaTitle, 200),
          metaDescription: text(page.metaDescription, 400),
          keywords: stringList(page.keywords, 30, 120),
        };
      }, 60),
    },
  };
};

const NORMALIZERS = { home: normalizeHome, about: normalizeAbout, settings: normalizeSettings };

/** Exported so the seed script validates through exactly the same code path the API does. */
export const normalizeSiteContent = (key, data) => {
  const normalize = NORMALIZERS[key];
  if (!normalize) throw new Error(`Unknown site content key: ${key}`);
  return normalize(parseObject(data));
};

// ── Public ──────────────────────────────────────────────────────────────────

/**
 * GET /api/site-content/:key
 *
 * 404 on an unpublished key is intentional: the frontend treats a miss as
 * "use the built-in defaults", which is how an unseeded database still
 * renders the shipped homepage instead of an empty one.
 */
export const getSiteContent = async (req, res) => {
  try {
    const key = String(req.params.key || '').toLowerCase();
    if (!KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: 'Unknown content key' });
    }

    const doc = await SiteContent.findOne({ key, status: 'published' })
      .select('key label data revision updatedAt')
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Not published' });

    return res.json({ success: true, content: doc });
  } catch (error) {
    logger.error('getSiteContent failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Could not load content' });
  }
};

/** GET /api/site-content — every published key in one call, for a build that wants all three. */
export const listSiteContent = async (req, res) => {
  try {
    const docs = await SiteContent.find({ status: 'published' })
      .select('key label data revision updatedAt')
      .lean();
    return res.json({
      success: true,
      content: Object.fromEntries(docs.map((doc) => [doc.key, doc])),
    });
  } catch (error) {
    logger.error('listSiteContent failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Could not load content' });
  }
};

// ── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/site-content/admin/all — every key, including ones never written. */
export const adminListSiteContent = async (req, res) => {
  try {
    const existing = await SiteContent.find({}).select('key label status revision updatedAt updatedBy').lean();
    const byKey = Object.fromEntries(existing.map((doc) => [doc.key, doc]));

    const items = KEYS.map(
      (key) =>
        byKey[key] || {
          key,
          label: LABELS[key],
          status: 'draft',
          revision: 0,
          updatedAt: null,
          updatedBy: '',
          exists: false,
        }
    );

    return res.json({ success: true, items });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load content' });
  }
};

/** GET /api/site-content/admin/:key — drafts included, so an editor can stage a rewrite. */
export const adminGetSiteContent = async (req, res) => {
  try {
    const key = String(req.params.key || '').toLowerCase();
    if (!KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: 'Unknown content key' });
    }

    const doc = await SiteContent.findOne({ key }).lean();
    if (doc) return res.json({ success: true, content: doc });

    // A key that has never been written comes back as an empty but correctly
    // shaped document, so the admin form renders its sections rather than
    // crashing on a missing branch.
    return res.json({
      success: true,
      content: {
        key,
        label: LABELS[key],
        data: normalizeSiteContent(key, {}),
        status: 'draft',
        revision: 0,
        exists: false,
      },
    });
  } catch (error) {
    logger.error('adminGetSiteContent failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Could not load content' });
  }
};

/**
 * PUT /api/site-content/admin/:key
 * Upsert — opening a key that was never written and saving it must work
 * without a separate "create" step.
 */
export const adminSaveSiteContent = async (req, res) => {
  try {
    const key = String(req.params.key || '').toLowerCase();
    if (!KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: 'Unknown content key' });
    }

    const body = req.body || {};
    const doc = (await SiteContent.findOne({ key })) || new SiteContent({ key });

    doc.label = LABELS[key];
    doc.data = normalizeSiteContent(key, body.data ?? body);
    if (body.status !== undefined) doc.status = body.status === 'published' ? 'published' : 'draft';
    doc.revision = (doc.revision || 0) + 1;
    doc.updatedBy = req.admin?.email || '';

    // `data` is Mixed, so Mongoose cannot see that the nested tree changed.
    // Without this the save is a no-op and the editor's work vanishes with a
    // success toast — the worst possible failure mode.
    doc.markModified('data');
    await doc.save();

    await logAdminActivity(
      req.admin.email,
      'site_content_updated',
      'site_content',
      doc._id,
      LABELS[key],
      { key, status: doc.status, revision: doc.revision },
      req
    );

    try {
      await revalidateFrontend(PATHS[key]);
    } catch (error) {
      logger.warn('Site content revalidate failed', { key, error: error.message });
    }

    return res.json({ success: true, content: doc });
  } catch (error) {
    logger.error('adminSaveSiteContent failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/site-content/admin/upload-image — the image picker in every section editor. */
export const adminUploadSiteImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
    const uploaded = await uploadImageFile(req.file, 'site');
    return res.json({ success: true, ...uploaded });
  } catch (error) {
    logger.error('Site content image upload failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

export { KEYS as SITE_CONTENT_KEYS, LABELS as SITE_CONTENT_LABELS };
