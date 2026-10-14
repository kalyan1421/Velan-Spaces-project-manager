// Mirrors WEB_APP_PLAN.md §4 (Website). Kept local to the marketing area so the
// public site does not depend on src/lib while it is being built.

export const PORTFOLIO_CATEGORIES = ["residential", "commercial", "office", "kitchen", "other"] as const;

export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export type PublicPortfolioItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: PortfolioCategory;
  location: string | null;
  completionYear: number | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
  office: "Office",
  kitchen: "Kitchen",
  other: "Other",
};

/** Line-art placeholder shown when an item has no photo yet. */
export const CATEGORY_PLACEHOLDERS: Record<PortfolioCategory, string> = {
  residential: "/marketing/room-living.svg",
  commercial: "/marketing/room-office.svg",
  office: "/marketing/room-office.svg",
  kitchen: "/marketing/room-kitchen.svg",
  other: "/marketing/room-renovation.svg",
};

export function isPortfolioCategory(value: unknown): value is PortfolioCategory {
  return typeof value === "string" && (PORTFOLIO_CATEGORIES as readonly string[]).includes(value);
}

/** Parses `?category=` (string | string[] | undefined) into a known category or null. */
export function parseCategoryParam(value: string | string[] | undefined): PortfolioCategory | null {
  const first = Array.isArray(value) ? value[0] : value;
  const normalized = first?.trim().toLowerCase();
  return isPortfolioCategory(normalized) ? normalized : null;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 160 && SLUG_PATTERN.test(slug);
}

/** Cover first, then gallery images, without duplicates. */
export function galleryImages(item: Pick<PublicPortfolioItem, "coverImageUrl" | "imageUrls">): string[] {
  const all = [item.coverImageUrl, ...item.imageUrls].filter((url): url is string => Boolean(url));
  return Array.from(new Set(all));
}

export function coverImage(item: Pick<PublicPortfolioItem, "coverImageUrl" | "imageUrls">): string | null {
  return galleryImages(item)[0] ?? null;
}
