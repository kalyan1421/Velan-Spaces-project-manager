import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "cn";

import { Container, SectionHeading, textLinkStyles } from "@/components/marketing/primitives";
import { EnquiryCta, ProcessSection } from "@/components/marketing/sections";
import { pageMetadata } from "@/components/marketing/seo";
import { services } from "@/content/site";

export const metadata = pageMetadata({
  title: "Interior design services",
  description:
    "Full home interiors, modular kitchens, wardrobes, living and bedroom interiors, office fit-outs and renovation — designed and built by one team.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <section className="border-b border-ink/10 bg-canvas">
        <Container className="py-16 sm:py-20">
          <SectionHeading
            as="h1"
            eyebrow="Services"
            title="Everything your space needs, from drawing to handover"
            intro="Choose one service or bring us the whole home. Every project gets designs you approve first and an itemised quotation before work starts."
          />
          <nav aria-label="Services on this page" className="mt-10">
            <ul className="flex flex-wrap gap-2">
              {services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`#${service.slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-white px-4 text-[0.95rem] text-ink/85 transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>

      <div className="divide-y divide-ink/10">
        {services.map((service, index) => (
          <section key={service.slug} id={service.slug} aria-labelledby={`${service.slug}-heading`} className="scroll-mt-20 py-16 sm:py-24">
            <Container className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className={cn("relative aspect-[4/3] overflow-hidden rounded-3xl bg-canvas", index % 2 === 1 && "md:order-2")}>
                <Image src={service.illustration} alt="" fill unoptimized className="object-contain p-8 sm:p-12" />
              </div>
              <div>
                <h2
                  id={`${service.slug}-heading`}
                  className="font-heading text-3xl font-light leading-[1.1] tracking-[-0.02em] text-ink sm:text-4xl"
                >
                  {service.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-ink/75">{service.description}</p>
                <h3 className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-ink/70">What&apos;s included</h3>
                <ul className="mt-4 space-y-3">
                  {service.includes.map((line) => (
                    <li key={line} className="flex gap-3 leading-relaxed text-ink/85">
                      <span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-gold" />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/contact?service=${service.slug}#enquiry`}
                  className={cn(textLinkStyles, "mt-8 inline-flex items-center gap-1.5")}
                >
                  Enquire about {service.title.replace(/ \(.*\)$/, "").toLowerCase()}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </Container>
          </section>
        ))}
      </div>

      <ProcessSection className="border-t border-ink/10 bg-canvas" />

      <EnquiryCta title="Not sure which service you need?" />
    </>
  );
}
