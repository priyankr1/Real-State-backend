import sanitizeHtmlLib from "sanitize-html";

/**
 * Allowlist-based sanitizer for rich-text blog bodies.
 *
 * Sanitizing at the write boundary (not at render) means the database only
 * ever holds safe HTML, so the frontend can render it directly and a future
 * consumer (RSS, llms-full.txt, a mobile app) inherits the same guarantee.
 *
 * This is an allowlist, never a denylist — anything not named here is dropped.
 */
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr", "div", "span",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
  "blockquote", "pre", "code",
  "ul", "ol", "li",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
];

const options = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    // The editor writes alignment/heading marks as classes, and tables need
    // span attributes to keep their shape.
    "*": ["class", "id", "colspan", "rowspan", "data-*"],
  },
  // Only real web/CDN URLs. No javascript:, no vbscript:, no file:.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  // Anything that could execute or frame content is removed with its contents.
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed"],
  transformTags: {
    // Every external link opens safely: rel prevents reverse-tabnabbing and
    // stops us leaking referrer/authority to arbitrary destinations.
    a: (tagName, attribs) => {
      const href = attribs.href || "";
      const isExternal = /^https?:\/\//i.test(href);
      return {
        tagName: "a",
        attribs: {
          ...attribs,
          ...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer nofollow" }
            : {}),
        },
      };
    },
    // Body copy must not contain an <h1> — the page template owns the single
    // h1, and a second one costs the SEO/a11y audits.
    h1: "h2",
  },
  // Drop inline styles entirely rather than trying to parse them.
  allowedStyles: {},
};

export function sanitizeRichText(html) {
  if (typeof html !== "string" || !html.trim()) return "";
  return sanitizeHtmlLib(html, options);
}

/** Strips all markup, for excerpts, reading time and plain-text corpora. */
export function htmlToPlainText(html) {
  if (typeof html !== "string" || !html) return "";
  return sanitizeHtmlLib(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default sanitizeRichText;
