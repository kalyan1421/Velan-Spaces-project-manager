import { describe, expect, it } from "vitest";

import { site, type SiteConfig } from "../../../content/site";
import type { PublicPortfolioItem } from "../portfolio-types";
import { STATIC_PAGES, buildSitemap, businessJsonLd, jsonLdString } from "../seo";

const BASE = "https://velan.test";

function portfolioItem(slug: string, updatedAt: string): PublicPortfolioItem {
  return {
    id: slug,
    slug,
    title: slug,
    description: null,
    category: "kitchen",
    location: null,
    completionYear: null,
    coverImageUrl: null,
    imageUrls: [],
    sortOrder: 0,
    createdAt: "",
    updatedAt,
  };
}

describe("buildSitemap", () => {
  it("still lists every static page when the portfolio API is down", () => {
    const entries = buildSitemap(`${BASE}/`, { ok: false, items: [] });
    expect(entries).toHaveLength(STATIC_PAGES.length);
    expect(entries.map((entry) => entry.url)).toEqual([
      BASE,
      `${BASE}/services`,
      `${BASE}/portfolio`,
      `${BASE}/about`,
      `${BASE}/contact`,
      `${BASE}/privacy`,
    ]);
  });

  it("adds published portfolio items with valid lastModified dates only", () => {
    const entries = buildSitemap(BASE, {
      ok: true,
      items: [portfolioItem("modern-kitchen", "2026-03-04T05:06:07.000Z"), portfolioItem("old-item", "not a date")],
    });
    const kitchen = entries.find((entry) => entry.url === `${BASE}/portfolio/modern-kitchen`);
    const old = entries.find((entry) => entry.url === `${BASE}/portfolio/old-item`);
    expect(kitchen?.lastModified).toBe("2026-03-04T05:06:07.000Z");
    expect(old).toBeDefined();
    expect(old).not.toHaveProperty("lastModified");
  });
});

describe("businessJsonLd", () => {
  it("uses only known facts and omits unset ones", () => {
    const data = businessJsonLd({ ...site, phone: null, address: null, city: null, serviceAreas: null, foundingYear: null });
    expect(data["@type"]).toBe("HomeAndConstructionBusiness");
    expect(data.email).toBe(site.email);
    for (const key of ["telephone", "address", "areaServed", "sameAs", "foundingDate"]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it("adds phone, address and profiles once they are set", () => {
    const config: SiteConfig = {
      ...site,
      phone: "+91 90000 00000",
      address: { streetAddress: "1 Test St", locality: "Testville", region: "TN", postalCode: "600001", country: "IN" },
      social: { ...site.social, instagram: "https://instagram.com/test" },
    };
    const data = businessJsonLd(config);
    expect(data.telephone).toBe("+91 90000 00000");
    expect(data.address).toMatchObject({ "@type": "PostalAddress", addressLocality: "Testville" });
    expect(data.sameAs).toEqual(["https://instagram.com/test"]);
  });
});

describe("jsonLdString", () => {
  it("escapes < so the payload cannot close the script tag", () => {
    expect(jsonLdString({ name: "</script><b>" })).not.toContain("<");
  });
});
