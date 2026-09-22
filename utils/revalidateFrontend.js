import logger from "./logger.js";

/**
 * Purges Next.js ISR caches after a content mutation.
 *
 * Fire-and-forget by design: publishing must not fail because the frontend is
 * redeploying or the secret is unset. Without this, a new post would only
 * appear once the ISR window expired.
 */
export async function revalidateFrontend(paths = []) {
  const base = process.env.FRONTEND_URL || process.env.WEBSITE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!base || !secret) {
    return { revalidated: false, reason: "FRONTEND_URL or REVALIDATE_SECRET not configured" };
  }

  const unique = [...new Set(paths.filter(Boolean))];

  await Promise.all(
    unique.map(async (path) => {
      try {
        const url = `${base.replace(/\/$/, "")}/api/revalidate?secret=${encodeURIComponent(secret)}&path=${encodeURIComponent(path)}`;
        const res = await fetch(url, { method: "POST" });
        if (!res.ok) {
          logger.warn("Revalidate call failed", { path, status: res.status });
        }
      } catch (error) {
        logger.warn("Revalidate call errored", { path, error: error.message });
      }
    })
  );

  return { revalidated: true, paths: unique };
}

export default revalidateFrontend;
