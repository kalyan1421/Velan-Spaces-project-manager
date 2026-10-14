import { MessageCircle, Phone } from "lucide-react";

import { cn } from "cn";

import { telHref, whatsappHref } from "../../content/site";

/**
 * Sticky Call / WhatsApp bar on phones (R-C6). Renders nothing until a phone
 * or WhatsApp number is set in src/content/site.ts.
 */
export function MobileActionBar() {
  const tel = telHref();
  const whatsapp = whatsappHref();
  if (!tel && !whatsapp) return null;

  const action =
    "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full font-medium focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <>
      {/* Spacer so the fixed bar never covers the end of the page. */}
      <div aria-hidden="true" className="h-20 md:hidden" />
      <nav
        aria-label="Quick contact"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <div className="flex gap-3">
          {tel ? (
            <a href={tel} className={cn(action, "border border-ink/25 text-ink focus-visible:outline-ink")}>
              <Phone aria-hidden="true" className="size-5" />
              Call us
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(action, "bg-ink text-white focus-visible:outline-ink")}
            >
              <MessageCircle aria-hidden="true" className="size-5" />
              WhatsApp
            </a>
          ) : null}
        </div>
      </nav>
    </>
  );
}
