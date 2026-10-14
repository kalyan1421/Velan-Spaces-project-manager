import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getPortfolio, getPortfolioItem } from "@/components/marketing/portfolio-data";
import {
  CATEGORY_LABELS,
  CATEGORY_PLACEHOLDERS,
  galleryImages,
  type PublicPortfolioItem,
} from "@/components/marketing/portfolio-types";
import { PortfolioGrid, isLocalImage } from "@/components/marketing/portfolio-ui";
import { ButtonLink, Container, Eyebrow, textLinkStyles } from "@/components/marketing/primitives";
import { breadcrumbJsonLd, jsonLdString, pageMetadata } from "@/components/marketing/seo";
import { site } from "@/content/site";

/** Cache Components requires at least one param; this one never matches an item. */
const PLACEHOLDER_SLUG = "__placeholder__";

export async function generateStaticParams() {
  const portfolio = await getPortfolio();
  const params = portfolio.items.map((item) => ({ slug: item.slug }));
  return params.length > 0 ? params : [{ slug: PLACEHOLDER_SLUG }];
}

function describe(item: PublicPortfolioItem): string {
  if (item.description) {
    const text = item.description.replace(/\s+/g, " ").trim();
    return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
  }
  const where = item.location ? ` in ${item.location}` : "";
  return `${CATEGORY_LABELS[item.category]} project${where}, designed and built by ${site.name}.`;
}

export async function generateMetadata({ params }: PageProps<"/portfolio/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPortfolioItem(slug);

  if (result.status === "not-found") {
    return { title: "Project not found", robots: { index: false, follow: true } };
  }
  if (result.status === "error") {
    return pageMetadata({
      title: "Portfolio",
      description: "Completed projects by Velan Spaces.",
      path: `/portfolio/${slug}`,
      noIndex: true,
    });
  }

  const { item } = result;
  const cover = galleryImages(item)[0];
  return pageMetadata({
    title: item.title,
    description: describe(item),
    path: `/portfolio/${item.slug}`,
    image: cover ? { url: cover, alt: item.title } : undefined,
  });
}

function relatedItems(current: PublicPortfolioItem, all: PublicPortfolioItem[], count = 3): PublicPortfolioItem[] {
  const others = all.filter((item) => item.slug !== current.slug);
  const sameCategory = others.filter((item) => item.category === current.category);
  const rest = others.filter((item) => item.category !== current.category);
  return [...sameCategory, ...rest].slice(0, count);
}

async function PortfolioDetail({ params }: Pick<PageProps<"/portfolio/[slug]">, "params">) {
  const { slug } = await params;
  const result = await getPortfolioItem(slug);

  if (result.status === "not-found") notFound();
  if (result.status === "error") return <DetailUnavailable />;

  const { item } = result;
  const images = galleryImages(item);
  const [cover, ...gallery] = images;
  const paragraphs = item.description ? item.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
  const portfolio = await getPortfolio();
  const related = relatedItems(item, portfolio.items);

  const facts = [
    { label: "Type", value: CATEGORY_LABELS[item.category] },
    item.location ? { label: "Location", value: item.location } : null,
    item.completionYear ? { label: "Completed", value: String(item.completionYear) } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbJsonLd(site.url, [
              { name: "Home", path: "/" },
              { name: "Portfolio", path: "/portfolio" },
              { name: item.title, path: `/portfolio/${item.slug}` },
            ]),
          ),
        }}
      />

      <article>
        <header className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <Eyebrow>{CATEGORY_LABELS[item.category]}</Eyebrow>
            <h1 className="mt-4 font-heading text-4xl font-light leading-[1.05] tracking-[-0.03em] text-balance text-ink sm:text-5xl lg:text-6xl">
              {item.title}
            </h1>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-5 lg:col-span-4 lg:grid-cols-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs font-medium uppercase tracking-[0.16em] text-ink/70">{fact.label}</dt>
                <dd className="mt-1 text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="relative mt-10 aspect-[4/3] overflow-hidden rounded-3xl bg-canvas sm:aspect-[16/9]">
          {cover ? (
            <Image
              src={cover}
              alt={`${item.title} — main photo`}
              fill
              sizes="(min-width: 1152px) 1088px, 100vw"
              fetchPriority="high"
              loading="eager"
              unoptimized={isLocalImage(cover)}
              className="object-cover"
            />
          ) : (
            <Image
              src={CATEGORY_PLACEHOLDERS[item.category]}
              alt=""
              fill
              unoptimized
              className="object-contain p-10"
            />
          )}
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {paragraphs.length > 0 ? (
              <div className="space-y-5 text-lg leading-relaxed text-ink/80">
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-lg leading-relaxed text-ink/80">
                Ask us about this project — we&apos;re happy to walk you through the design choices, materials and
                timeline.
              </p>
            )}
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="rounded-3xl bg-canvas p-6 sm:p-8">
              <h2 className="font-heading text-2xl font-light tracking-[-0.01em] text-ink">Planning something similar?</h2>
              <p className="mt-3 leading-relaxed text-ink/75">
                Tell us about your space and we&apos;ll call you back. {site.callbackPromise}
              </p>
              <ButtonLink href="/contact#enquiry" className="mt-6 w-full sm:w-auto">
                Get a call back
              </ButtonLink>
            </div>
          </aside>
        </div>

        {gallery.length > 0 ? (
          <section aria-labelledby="gallery-heading" className="mt-16">
            <h2 id="gallery-heading" className="font-heading text-2xl font-light tracking-[-0.01em] text-ink sm:text-3xl">
              More photos
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              {gallery.map((url, index) => (
                <li
                  key={url}
                  className={
                    gallery.length % 2 === 1 && index === gallery.length - 1 ? "sm:col-span-2" : undefined
                  }
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-canvas">
                    <Image
                      src={url}
                      alt={`${item.title} — photo ${index + 2} of ${images.length}`}
                      fill
                      sizes="(min-width: 1152px) 544px, (min-width: 640px) 50vw, 100vw"
                      unoptimized={isLocalImage(url)}
                      className="object-cover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-20 border-t border-ink/10 pt-16 sm:mt-28">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="related-heading" className="font-heading text-3xl font-light tracking-[-0.02em] text-ink">
              More of our work
            </h2>
            <Link href="/portfolio" className={textLinkStyles}>
              View the full portfolio
            </Link>
          </div>
          <div className="mt-10">
            <PortfolioGrid items={related} />
          </div>
        </section>
      ) : null}
    </>
  );
}

function DetailUnavailable() {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <Image
        src="/marketing/empty-portfolio.svg"
        alt=""
        width={480}
        height={360}
        unoptimized
        className="mx-auto w-full max-w-xs"
      />
      <h1 className="mt-8 font-heading text-3xl font-light tracking-[-0.02em] text-ink sm:text-4xl">
        This project can&apos;t be shown right now
      </h1>
      <p className="mt-4 leading-relaxed text-ink/75">
        Our portfolio is being updated. Try again in a few minutes, or ask us for examples of similar work.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
        <ButtonLink href="/contact#enquiry">Ask for examples</ButtonLink>
        <Link href="/portfolio" className={textLinkStyles}>
          Back to portfolio
        </Link>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-24 rounded bg-canvas" />
      <div className="mt-6 h-12 w-3/4 rounded-lg bg-canvas motion-safe:animate-pulse" />
      <div className="mt-10 aspect-[4/3] rounded-3xl bg-canvas motion-safe:animate-pulse sm:aspect-[16/9]" />
    </div>
  );
}

export default function PortfolioItemPage({ params }: PageProps<"/portfolio/[slug]">) {
  return (
    <Container className="pt-8 pb-20 sm:pt-10 sm:pb-28">
      <nav aria-label="Breadcrumb" className="mb-10">
        <Link
          href="/portfolio"
          className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-[0.95rem] text-ink/80 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All projects
        </Link>
      </nav>
      <Suspense fallback={<DetailSkeleton />}>
        <PortfolioDetail params={params} />
      </Suspense>
    </Container>
  );
}
