import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { getEnv } from "@/lib/env";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Evaluated when the root layout is prerendered: set APP_URL at build time too.
  metadataBase: new URL(getEnv().APP_URL),
  title: {
    default: "Velan Spaces",
    template: "%s · Velan Spaces",
  },
  description: "Velan Spaces — interior design and construction.",
  applicationName: "Velan Spaces",
};

export const viewport: Viewport = {
  themeColor: "#1A1A2E",
};

/**
 * Root layout stays server-only (no client providers) so public pages ship
 * minimal JS (R-C5). The staff app, portal and auth layouts mount <Providers>.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
