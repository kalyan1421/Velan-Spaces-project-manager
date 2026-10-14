import Link from "next/link";
import { Suspense } from "react";

import { getPortfolio } from "@/components/marketing/portfolio-data";
import {
  CATEGORY_LABELS,
  PORTFOLIO_CATEGORIES,
  parseCategoryParam,
  type PortfolioCategory,
} from "@/components/marketing/portfolio-types";
import {
  CategoryFilter,
  PortfolioGrid,
  PortfolioGridSkeleton,
  PortfolioUnavailable,
} from "@/components/marketing/portfolio-ui";
import { Container, SectionHeading, textLinkStyles } from "@/components/marketing/primitives";
import { EnquiryCta } from "@/components/marketing/sections";
import { pageMetadata } from "@/components/marketing/seo";

// Filtered views (?category=) canonicalise to the main portfolio page.
export const metadata = pageMetadata({
  title: "Portfolio",
  description:
    "Completed homes, modular kitchens, offices and commercial spaces designed and built by Velan Spaces. Filter by project type.",
  path: "/portfolio",
});

async function PortfolioResults({ searchParams }: Pick<PageProps<"/portfolio">, "searchParams">) {
  const params = await searchParams;
  const active = parseCategoryParam(params.category);
  const portfolio = await getPortfolio();

  if (!portfolio.ok) {
    return (
      <>
        <CategoryFilter active={active} />
        <PortfolioUnavailable variant="error" className="mt-10" headingLevel="h2" />
      </>
    );
  }

  if (portfolio.items.length === 0) {
    return <PortfolioUnavailable variant="empty" headingLevel="h2" />;
  }

  const counts = Object.fromEntries(
    PORTFOLIO_CATEGORIES.map((category) => [
      category,
      portfolio.items.filter((item) => item.category === category).length,
    ]),
  ) as Record<PortfolioCategory, number>;

  const items = active ? portfolio.items.filter((item) => item.category === active) : portfolio.items;
  const label = active ? CATEGORY_LABELS[active].toLowerCase() : null;

  return (
    <>
      <CategoryFilter active={active} counts={counts} />
      <p className="sr-only" role="status">
        {active ? `Showing ${items.length} ${label} projects` : `Showing all ${items.length} projects`}
      </p>
      <div className="mt-10">
        {items.length > 0 ? (
          <PortfolioGrid items={items} headingLevel="h2" />
        ) : (
          <div className="rounded-3xl border border-ink/10 bg-canvas p-8 sm:p-10">
            <h2 className="font-heading text-2xl font-light text-ink">No {label} projects here yet</h2>
            <p className="mt-3 max-w-lg leading-relaxed text-ink/75">
              We haven&apos;t published any {label} projects yet. Browse everything else, or ask us for examples on a
              call.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              <Link href="/portfolio" className={textLinkStyles}>
                See all projects
              </Link>
              <Link href="/contact#enquiry" className={textLinkStyles}>
                Ask for examples
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function PortfolioPage({ searchParams }: PageProps<"/portfolio">) {
  return (
    <>
      <section className="pt-16 pb-20 sm:pt-20 sm:pb-28">
        <Container>
          <SectionHeading
            as="h1"
            eyebrow="Portfolio"
            title="Homes, kitchens and workspaces we've completed"
            intro="Every project here was designed and built by our team. Filter by the kind of space you're planning."
          />
          <div className="mt-10">
            <Suspense
              fallback={
                <>
                  <CategoryFilter active={null} />
                  <div className="mt-10">
                    <PortfolioGridSkeleton />
                  </div>
                </>
              }
            >
              <PortfolioResults searchParams={searchParams} />
            </Suspense>
          </div>
        </Container>
      </section>
      <EnquiryCta title="Planning something similar?" className="border-t border-ink/10" />
    </>
  );
}
