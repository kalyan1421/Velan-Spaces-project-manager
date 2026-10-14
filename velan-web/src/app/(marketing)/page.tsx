import { Suspense } from "react";

import { HeroRoomIllustration } from "@/components/marketing/illustrations";
import { getPortfolio } from "@/components/marketing/portfolio-data";
import {
  PortfolioGrid,
  PortfolioGridSkeleton,
  PortfolioUnavailable,
  ViewAllLink,
} from "@/components/marketing/portfolio-ui";
import { ButtonLink, Container, Eyebrow, Highlight, SectionHeading } from "@/components/marketing/primitives";
import { EnquiryCta, PortalHighlight, ProcessSection, ServicesOverview } from "@/components/marketing/sections";
import { businessJsonLd, jsonLdString, pageMetadata } from "@/components/marketing/seo";
import { site } from "@/content/site";

export const metadata = pageMetadata({
  description: site.description,
  path: "/",
});

const FEATURED_COUNT = 6;

async function FeaturedPortfolio() {
  const portfolio = await getPortfolio();
  if (!portfolio.ok) return <PortfolioUnavailable variant="error" />;
  if (portfolio.items.length === 0) return <PortfolioUnavailable variant="empty" />;
  return <PortfolioGrid items={portfolio.items.slice(0, FEATURED_COUNT)} />;
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(businessJsonLd()) }} />

      {/* Hero */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <Container className="grid items-center gap-10 pt-12 pb-16 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pt-20 lg:pb-24">
          <div className="lg:col-span-6">
            <Eyebrow>{site.city ? `Interior design & construction · ${site.city}` : "Interior design & construction"}</Eyebrow>
            <h1
              id="hero-heading"
              className="mt-5 font-heading text-[2.6rem] font-light leading-[1.04] tracking-[-0.035em] text-balance text-ink sm:text-6xl lg:text-[4.25rem]"
            >
              Interiors designed with care, <Highlight>built in full view</Highlight>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-ink/75">
              We design and build homes, kitchens and workspaces. You get an itemised quotation before work starts,
              then follow site photos, designs and the timeline in our app while it happens.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/contact#enquiry">Get a call back</ButtonLink>
              <ButtonLink href="/portfolio" variant="secondary">
                See our work
              </ButtonLink>
            </div>
            {site.stats && site.stats.length > 0 ? (
              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-ink/10 pt-6">
                {site.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-sm text-ink/70">{stat.label}</dt>
                    <dd className="mt-1 font-heading text-3xl font-light text-ink">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <div className="lg:col-span-6">
            <HeroRoomIllustration className="mx-auto w-full max-w-[36rem] text-ink lg:max-w-none" />
          </div>
        </Container>
      </section>

      <ServicesOverview />

      {/* Featured portfolio */}
      <section aria-labelledby="work-heading" className="py-20 sm:py-28">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="work-heading"
              eyebrow="Recent work"
              title="Spaces we've designed and built"
              intro="A selection of completed homes, kitchens and workspaces."
            />
            <div className="shrink-0">
              <ViewAllLink href="/portfolio">View the full portfolio</ViewAllLink>
            </div>
          </div>
          <div className="mt-12">
            <Suspense fallback={<PortfolioGridSkeleton count={3} />}>
              <FeaturedPortfolio />
            </Suspense>
          </div>
        </Container>
      </section>

      <ProcessSection className="border-t border-ink/10" />

      <PortalHighlight />

      <EnquiryCta />
    </>
  );
}
