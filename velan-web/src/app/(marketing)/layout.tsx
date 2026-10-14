import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MobileActionBar } from "@/components/marketing/mobile-action-bar";
import { DEFAULT_OG_IMAGE, DEFAULT_TITLE } from "@/components/marketing/seo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { site } from "@/content/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: DEFAULT_TITLE, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    title: DEFAULT_TITLE,
    description: site.description,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false, email: false, address: false },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white font-sans text-ink antialiased">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-5 py-3 font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-2 focus:outline-offset-2 focus:outline-sun"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <MobileActionBar />
    </div>
  );
}
