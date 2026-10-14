import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import {
  fetchPortfolioItem,
  fetchPortfolioList,
  type PortfolioItemResult,
  type PortfolioListResult,
} from "./api";

/**
 * Tag for on-demand revalidation. The website admin (head) can call
 * `revalidateTag(PORTFOLIO_CACHE_TAG)` after publishing/hiding an item so the
 * public site updates immediately instead of within ~5 minutes.
 */
export const PORTFOLIO_CACHE_TAG = "public-portfolio";

/*
 * Cache lifetimes (Cache Components / `use cache`):
 * - success: served from cache, regenerated in the background every 5 minutes
 *   (spec R-C2: changes visible within ~5 minutes).
 * - failure: kept for 1 minute only, so a temporarily unreachable API recovers
 *   quickly. `stale` stays at 5 minutes so the result can still be part of the
 *   prerendered static shell (lifetimes under 5 minutes are excluded from it).
 */

/** All published portfolio items (sortOrder asc). Never throws. */
export async function getPortfolio(): Promise<PortfolioListResult> {
  "use cache";
  cacheTag(PORTFOLIO_CACHE_TAG);

  const result = await fetchPortfolioList();
  if (result.ok) {
    cacheLife({ stale: 300, revalidate: 300, expire: 86_400 });
  } else {
    cacheLife({ stale: 300, revalidate: 60, expire: 3_600 });
  }
  return result;
}

/** One published item by slug. Never throws. */
export async function getPortfolioItem(slug: string): Promise<PortfolioItemResult> {
  "use cache";
  cacheTag(PORTFOLIO_CACHE_TAG, `${PORTFOLIO_CACHE_TAG}:${slug}`);

  const result = await fetchPortfolioItem(slug);
  if (result.status === "error") {
    cacheLife({ stale: 300, revalidate: 60, expire: 3_600 });
  } else {
    cacheLife({ stale: 300, revalidate: 300, expire: 86_400 });
  }
  return result;
}
