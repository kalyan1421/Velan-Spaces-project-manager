import { cacheLife } from "next/cache";
import Link from "next/link";

import { mainNav, services, site, socialLinks, telHref, whatsappHref } from "../../content/site";
import { Container } from "./primitives";
import { BrandMark } from "./site-header";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const footerLink =
  "rounded-sm text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun";

export function SiteFooter() {
  const tel = telHref();
  const whatsapp = whatsappHref();
  const socials = socialLinks();
  const address = site.address;

  return (
    <footer className="bg-ink text-white">
      <Container className="grid gap-12 py-16 md:grid-cols-12 md:gap-8 md:py-20">
        <div className="md:col-span-5">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sun"
          >
            <BrandMark className="relative block size-12 overflow-hidden rounded-xl bg-white" />
            <span className="font-heading text-xl font-medium tracking-[-0.01em]">{site.name}</span>
          </Link>
          <p className="mt-5 max-w-sm leading-relaxed text-white/75">
            Interior design and construction. Designs you approve before we build, itemised quotations, and
            progress you can follow in our app.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:col-span-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">Explore</h2>
            <ul className="mt-4 space-y-3">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={footerLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/login" className={footerLink}>
                  Client login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">Services</h2>
            <ul className="mt-4 space-y-3">
              {services.map((service) => (
                <li key={service.slug}>
                  <Link href={`/services#${service.slug}`} className={footerLink}>
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="md:col-span-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">Contact</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <a href={`mailto:${site.email}`} className={footerLink}>
                {site.email}
              </a>
            </li>
            {tel && site.phone ? (
              <li>
                <a href={tel} className={footerLink}>
                  {site.phone}
                </a>
              </li>
            ) : null}
            {whatsapp ? (
              <li>
                <a href={whatsapp} className={footerLink} target="_blank" rel="noopener noreferrer">
                  WhatsApp us
                </a>
              </li>
            ) : null}
            {address ? (
              <li className="leading-relaxed text-white/80">
                <address className="not-italic">
                  {address.streetAddress}
                  <br />
                  {address.locality}, {address.region} {address.postalCode}
                </address>
              </li>
            ) : null}
            {site.openingHours ? <li className="text-white/80">{site.openingHours}</li> : null}
          </ul>
          {socials.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {socials.map((social) => (
                <li key={social.href}>
                  <a href={social.href} className={footerLink} target="_blank" rel="noopener noreferrer">
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-3 py-6 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CurrentYear /> {site.name}
          </p>
          <Link href="/privacy" className={footerLink}>
            Privacy notice
          </Link>
        </Container>
      </div>
    </footer>
  );
}
