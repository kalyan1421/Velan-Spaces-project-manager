import type { MetadataRoute } from "next";

import { getPortfolio } from "@/components/marketing/portfolio-data";
import { buildSitemap } from "@/components/marketing/seo";
import { site } from "@/content/site";

// Public pages + published portfolio items. getPortfolio() never throws, so an
// unreachable API only drops the portfolio entries instead of failing the build.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const portfolio = await getPortfolio();
  return buildSitemap(site.url, portfolio);
}
