import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "cn";

import { portalFeatures, processSteps, services, site } from "../../content/site";
import { PendantLight } from "./illustrations";
import { ButtonLink, Container, SectionHeading, textLinkStyles } from "./primitives";

/* -------------------------------------------------------------------------- */
/* Services overview (home)                                                    */
/* -------------------------------------------------------------------------- */

export function ServicesOverview() {
  return (
    <section aria-labelledby="services-heading" className="bg-canvas py-20 sm:py-28">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="services-heading"
            eyebrow="What we do"
            title="Design and build, under one roof"
            intro="From a single modular kitchen to a full home, the team that designs your space is the team that builds it."
          />
          <Link href="/services" className={cn(textLinkStyles, "shrink-0 self-start md:self-auto")}>
            All services
          </Link>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.slug}>
              <article className="group relative flex h-full flex-col rounded-2xl border border-ink/10 bg-white p-5 transition-colors hover:border-ink/30">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-canvas">
                  <Image src={service.illustration} alt="" fill unoptimized className="object-contain p-4" />
                </div>
                <h3 className="mt-5 font-heading text-xl font-medium tracking-[-0.01em] text-ink">
                  <Link
                    href={`/services#${service.slug}`}
                    className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-solid focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
                  >
                    {service.title}
                  </Link>
                </h3>
                <p className="mt-2 leading-relaxed text-ink/75">{service.summary}</p>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Process — numbered because it is a real sequence                            */
/* -------------------------------------------------------------------------- */

export function ProcessSection({ className }: { className?: string }) {
  return (
    <section aria-labelledby="process-heading" className={cn("py-20 sm:py-28", className)}>
      <Container>
        <SectionHeading
          id="process-heading"
          eyebrow="How a project runs"
          title="From first call to handover"
          intro="You always know which step you're in and what happens next."
        />

        <ol className="relative mt-14 grid gap-10 lg:grid-cols-5 lg:gap-6">
          {/* Connecting line: vertical on phones, horizontal on desktop */}
          <span aria-hidden="true" className="absolute top-2 bottom-2 left-[1.375rem] w-px bg-ink/15 lg:hidden" />
          <span aria-hidden="true" className="absolute top-[1.375rem] right-[10%] left-[10%] hidden h-px bg-ink/15 lg:block" />
          {processSteps.map((step, index) => {
            const last = index === processSteps.length - 1;
            return (
              <li key={step.title} className="relative grid grid-cols-[2.75rem_1fr] gap-x-5 lg:grid-cols-1 lg:text-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 flex size-11 items-center justify-center rounded-full font-heading text-lg lg:mx-auto",
                    last ? "bg-sun text-ink" : "border border-ink/25 bg-white text-ink",
                  )}
                >
                  {index + 1}
                </span>
                <div className="lg:mt-5">
                  <h3 className="font-heading text-lg font-medium text-ink">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-ink/75 lg:text-[0.95rem]">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Client app / portal highlight                                               */
/* -------------------------------------------------------------------------- */

function PhoneMockup() {
  // Purely illustrative — the real features are listed in text beside it.
  const timeline = [
    { label: "Design approved", state: "done" },
    { label: "Civil work", state: "done" },
    { label: "Carpentry", state: "now" },
    { label: "Painting", state: "next" },
    { label: "Handover", state: "next" },
  ] as const;

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[19rem]">
      <div className="absolute -top-10 -right-8 size-32 rounded-full bg-sun/90 blur-[2px]" />
      <div className="relative rounded-[2.75rem] border border-white/25 bg-deep p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
        <div className="overflow-hidden rounded-[2.1rem] bg-white text-ink">
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-16 rounded-full bg-ink/15" />
          </div>
          <div className="px-5 pt-4 pb-6">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-ink/60">Your project</p>
            <p className="mt-1 font-heading text-lg font-medium">Home interiors</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full w-[62%] rounded-full bg-gold" />
            </div>
            <p className="mt-1.5 text-xs text-ink/70">Carpentry in progress</p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10">
              <div className="relative aspect-[16/10] bg-canvas">
                <Image src="/marketing/room-kitchen.svg" alt="" fill unoptimized className="object-contain p-3" />
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink/60">Site update</p>
                <p className="mt-0.5 text-sm font-medium">Kitchen base units fixed</p>
              </div>
            </div>

            <ol className="mt-5 space-y-2.5">
              {timeline.map((step) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      step.state === "done" && "bg-ink text-white",
                      step.state === "now" && "bg-sun ring-4 ring-sun/40",
                      step.state === "next" && "border border-ink/25",
                    )}
                  >
                    {step.state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className={cn(step.state === "next" ? "text-ink/55" : "text-ink", step.state === "now" && "font-medium")}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalHighlight() {
  return (
    <section aria-labelledby="portal-heading" className="overflow-hidden bg-deep py-20 text-white sm:py-28">
      <Container className="grid items-center gap-16 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <SectionHeading
            id="portal-heading"
            tone="dark"
            eyebrow="The Velan Spaces app"
            title="Watch your home take shape, from wherever you are"
            intro="Once work starts, you're invited to the Velan Spaces app and web portal for your project. The site team posts progress there, so you never have to chase anyone for an update."
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {portalFeatures.map((feature) => (
              <li key={feature.title} className="flex gap-4">
                <span aria-hidden="true" className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sun text-ink">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
                <div>
                  <h3 className="font-medium text-white">{feature.title}</h3>
                  <p className="mt-1 leading-relaxed text-white/75">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <PhoneMockup />
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                      */
/* -------------------------------------------------------------------------- */

export function EnquiryCta({
  title = "Tell us about your space",
  className,
}: {
  title?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby="cta-heading" className={cn("relative overflow-hidden bg-white pb-24 sm:pb-32", className)}>
      <PendantLight className="pointer-events-none absolute top-0 left-1/2 h-72 w-60 -translate-x-1/2 text-ink sm:h-80 sm:w-64" />
      <Container className="relative pt-44 text-center sm:pt-52">
        <h2
          id="cta-heading"
          className="mx-auto max-w-xl font-heading text-3xl font-light leading-[1.1] tracking-[-0.02em] text-balance text-ink sm:text-5xl"
        >
          {title}
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-pretty text-ink/75 sm:text-lg">
          Share a few details about your home or workspace and we&apos;ll talk it through with you.{" "}
          {site.callbackPromise}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <ButtonLink href="/contact#enquiry">Get a call back</ButtonLink>
          <a href={`mailto:${site.email}`} className={textLinkStyles}>
            or email {site.email}
          </a>
        </div>
      </Container>
    </section>
  );
}
