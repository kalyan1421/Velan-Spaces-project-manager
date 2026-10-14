import Image from "next/image";

import { Container, Highlight, SectionHeading } from "@/components/marketing/primitives";
import { EnquiryCta, PortalHighlight, ProcessSection } from "@/components/marketing/sections";
import { pageMetadata } from "@/components/marketing/seo";
import { site, values } from "@/content/site";

export const metadata = pageMetadata({
  title: "About us",
  description:
    "How Velan Spaces works: designs you approve before we build, itemised quotations, and progress you can follow in our client app.",
  path: "/about",
});

export default function AboutPage() {
  const facts = [
    site.foundingYear ? { label: "Founded", value: String(site.foundingYear) } : null,
    site.city ? { label: "Based in", value: site.city } : null,
    site.serviceAreas && site.serviceAreas.length > 0 ? { label: "Projects in", value: site.serviceAreas.join(", ") } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <>
      <section className="overflow-hidden">
        <Container className="grid items-center gap-12 pt-16 pb-20 sm:pt-20 lg:grid-cols-12 lg:pb-28">
          <div className="lg:col-span-7">
            <SectionHeading
              as="h1"
              eyebrow="About us"
              title={
                <>
                  A studio that designs, builds, <Highlight>and shows you every step</Highlight>
                </>
              }
              intro={`${site.name} is an interior design and construction studio. We take projects from the first conversation to handover, and keep you close to the work the whole way through.`}
            />
            {facts.length > 0 ? (
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-ink/10 pt-6">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-xs font-medium uppercase tracking-[0.16em] text-ink/70">{fact.label}</dt>
                    <dd className="mt-1 text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <div className="lg:col-span-5">
            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[2rem] bg-canvas">
              <Image
                src="/brand/logo.png"
                alt={`${site.name} logo: a line drawing of a living room with a pendant lamp and the sun`}
                fill
                sizes="(min-width: 1024px) 384px, 80vw"
                className="scale-125 object-contain mix-blend-multiply"
              />
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="values-heading" className="border-t border-ink/10 bg-canvas py-20 sm:py-28">
        <Container>
          <SectionHeading
            id="values-heading"
            eyebrow="How we work"
            title="What you can expect from us"
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2">
            {values.map((value) => (
              <li key={value.title} className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
                <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-gold" />
                <h3 className="mt-6 font-heading text-xl font-medium tracking-[-0.01em] text-ink">{value.title}</h3>
                <p className="mt-3 leading-relaxed text-ink/75">{value.description}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <ProcessSection />

      <PortalHighlight />

      <EnquiryCta title="Let's talk about your space" />
    </>
  );
}
