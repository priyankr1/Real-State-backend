/**
 * URL slug helpers for blog posts.
 *
 * Slugs are permanent public identifiers — once a post is published its slug
 * is what search engines and AI crawlers have cited, so changing one should
 * be a deliberate act, not a side effect of editing the title.
 */

/** "Noida Price Trends 2026!" -> "noida-price-trends-2026" */
export function slugify(input = "") {
  return String(input)
    .normalize("NFKD")
    // Strip combining marks so accented characters degrade to their base letter.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

/**
 * Returns a slug that does not yet exist in the collection, appending -2, -3…
 * `excludeId` lets an update keep its own slug without colliding with itself.
 */
export async function uniqueSlug(Model, desired, excludeId = null) {
  const base = slugify(desired) || `post-${Date.now()}`;
  let candidate = base;
  let suffix = 1;

  // Bounded loop: a pathological number of same-titled posts should fall back
  // to a timestamp rather than spin.
  while (suffix < 50) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const clash = await Model.exists(query);
    if (!clash) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

export default slugify;
