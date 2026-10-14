import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "cn";

import { site } from "../../content/site";
import {
  CATEGORY_LABELS,
  CATEGORY_PLACEHOLDERS,
  PORTFOLIO_CATEGORIES,
  coverImage,
  type PortfolioCategory,
  type PublicPortfolioItem,
} from "./portfolio-types";
import { ButtonLink, textLinkStyles } from "./primitives";

/**
 * Local Supabase / localhost images can't go through the image optimizer
 * (it refuses private hosts by default), so serve those as-is in development.
 */
export function isLocalImage(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function itemMeta(item: Pick<PublicPortfolioItem, "category" | "location" | "completionYear">): string {
  return [CATEGORY_LABELS[item.category], item.location, item.completionYear ? String(item.completionYear) : null]
    .filter(Boolean)
    .join(" · ");
}

export const GRID_SIZES = "(min-width: 1152px) 368px, (min-width: 640px) 50vw, 100vw";

export function PortfolioCard({ item, headingLevel = "h3" }: { item: PublicPortfolioItem; headingLevel?: "h2" | "h3" }) {
  const image = coverImage(item);
  const Heading = headingLevel;
  return (
    <article className="group relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-canvas">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes={GRID_SIZES}
            unoptimized={isLocalImage(image)}
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <Image
            src={CATEGORY_PLACEHOLDERS[item.category]}
            alt=""
            fill
            unoptimized
            className="object-contain p-6"
          />
        )}
      </div>
      <Heading className="mt-4 font-heading text-lg font-medium leading-snug text-ink">
        <Link
          href={`/portfolio/${item.slug}`}
          className="rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-solid focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ink"
        >
          {item.title}
        </Link>
      </Heading>
      <p className="mt-1 text-sm text-ink/70">{itemMeta(item)}</p>
    </article>
  );
}

export function PortfolioGrid({ items, headingLevel }: { items: PublicPortfolioItem[]; headingLevel?: "h2" | "h3" }) {
  return (
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.slug}>
          <PortfolioCard item={item} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

export function PortfolioGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <div className="aspect-[4/3] rounded-2xl bg-canvas motion-safe:animate-pulse" />
          <div className="mt-4 h-5 w-2/3 rounded bg-canvas" />
          <div className="mt-2 h-4 w-1/3 rounded bg-canvas" />
        </div>
      ))}
    </div>
  );
}

/**
 * Shown when the portfolio API is unreachable or nothing is published yet.
 * It is a direction, not an apology: talk to us and we'll share examples.
 */
export function PortfolioUnavailable({
  variant,
  className,
  headingLevel = "h3",
}: {
  variant: "error" | "empty";
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "grid items-center gap-8 rounded-3xl border border-ink/10 bg-canvas p-6 sm:p-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]",
        className,
      )}
    >
      <Image
        src="/marketing/empty-portfolio.svg"
        alt=""
        width={480}
        height={360}
        unoptimized
        className="mx-auto w-full max-w-xs md:max-w-none"
      />
      <div>
        <Heading className="font-heading text-2xl font-light tracking-[-0.01em] text-ink sm:text-3xl">
          Our portfolio is being updated
        </Heading>
        <p className="mt-3 leading-relaxed text-ink/75">
          {variant === "error"
            ? "Project photos aren't loading right now. Ask us for examples of recent homes, kitchens and offices, and we'll share them with you."
            : "We're photographing recent projects for this page. Ask us for examples of homes, kitchens and offices similar to yours."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <ButtonLink href="/contact#enquiry">Ask for examples</ButtonLink>
          <a href={`mailto:${site.email}`} className={textLinkStyles}>
            {site.email}
          </a>
        </div>
      </div>
    </div>
  );
}

/** Server-rendered category filter: plain links, no client JavaScript. */
export function CategoryFilter({
  active,
  counts,
}: {
  active: PortfolioCategory | null;
  /** When given, categories with no items are hidden (unless active). */
  counts?: Partial<Record<PortfolioCategory, number>> | null;
}) {
  const categories = PORTFOLIO_CATEGORIES.filter(
    (category) => !counts || (counts[category] ?? 0) > 0 || category === active,
  );
  const options: { label: string; href: string; value: PortfolioCategory | null }[] = [
    { label: "All projects", href: "/portfolio", value: null },
    ...categories.map((category) => ({
      label: CATEGORY_LABELS[category],
      href: `/portfolio?category=${category}`,
      value: category,
    })),
  ];

  return (
    <nav aria-label="Filter projects by type" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 pb-1">
        {options.map((option) => {
          const isActive = option.value === active;
          return (
            <li key={option.href}>
              <Link
                href={option.href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.95rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-ink/20 bg-white text-ink/85 hover:border-ink hover:text-ink",
                )}
              >
                {option.label}
                {counts && option.value && counts[option.value] ? (
                  <span className={cn("ml-2 text-sm", isActive ? "text-white/75" : "text-ink/70")}>
                    {counts[option.value]}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ViewAllLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className={cn(textLinkStyles, "inline-flex items-center gap-1.5")}>
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}
