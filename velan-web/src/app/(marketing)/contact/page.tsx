import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { EnquiryForm } from "@/components/marketing/enquiry-form";
import { Container, SectionHeading, textLinkStyles } from "@/components/marketing/primitives";
import { pageMetadata } from "@/components/marketing/seo";
import { site, telHref, whatsappHref } from "@/content/site";

export const metadata = pageMetadata({
  title: "Contact us",
  description:
    "Tell us about your home or workspace and we'll call you back. Enquire about full home interiors, modular kitchens, wardrobes, office fit-outs or renovation.",
  path: "/contact",
});

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink/70">{label}</p>
        <div className="mt-1 text-ink">{children}</div>
      </div>
    </li>
  );
}

export default function ContactPage() {
  const tel = telHref();
  const whatsapp = whatsappHref();
  const next = [
    { title: "We call you back", description: site.callbackPromise },
    { title: "We visit and measure", description: "A site visit to see the space and understand what you need." },
    { title: "You get a design and a quotation", description: "Layouts and 3D views, then an itemised quotation to decide on." },
  ];

  return (
    <section className="pt-16 pb-20 sm:pt-20 sm:pb-28">
      <Container className="grid gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <SectionHeading
            as="h1"
            eyebrow="Contact"
            title="Tell us about your space"
            intro="Share a few details and we'll call you back to talk it through. You don't need to have everything figured out yet."
          />
        </div>

        <div id="enquiry" className="scroll-mt-24 lg:col-span-7 lg:row-span-2">
          <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_30px_60px_-40px_rgba(26,26,46,0.35)] sm:p-8 lg:p-10">
            <h2 className="font-heading text-2xl font-light tracking-[-0.01em] text-ink sm:text-3xl">Request a call back</h2>
            <div className="mt-4">
              <EnquiryForm />
            </div>
          </div>
        </div>

        <div className="space-y-12 lg:col-span-5">
          <div>
            <h2 className="font-heading text-xl font-medium text-ink">What happens next</h2>
            <ol className="mt-5 space-y-5">
              {next.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[2.25rem_1fr] gap-x-4">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full border border-ink/25 font-heading text-ink"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{step.title}</p>
                    <p className="mt-1 leading-relaxed text-ink/75">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="font-heading text-xl font-medium text-ink">Reach us directly</h2>
            <ul className="mt-5 space-y-5">
              <ContactRow icon={<Mail className="size-5" />} label="Email">
                <a href={`mailto:${site.email}`} className={textLinkStyles}>
                  {site.email}
                </a>
              </ContactRow>
              {tel && site.phone ? (
                <ContactRow icon={<Phone className="size-5" />} label="Phone">
                  <a href={tel} className={textLinkStyles}>
                    {site.phone}
                  </a>
                </ContactRow>
              ) : null}
              {whatsapp ? (
                <ContactRow icon={<MessageCircle className="size-5" />} label="WhatsApp">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={textLinkStyles}>
                    Message us on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </ContactRow>
              ) : null}
              {site.address ? (
                <ContactRow icon={<MapPin className="size-5" />} label="Studio">
                  <address className="not-italic leading-relaxed">
                    {site.address.streetAddress}
                    <br />
                    {site.address.locality}, {site.address.region} {site.address.postalCode}
                  </address>
                </ContactRow>
              ) : null}
              {site.openingHours ? (
                <ContactRow icon={<Clock className="size-5" />} label="Hours">
                  {site.openingHours}
                </ContactRow>
              ) : null}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
