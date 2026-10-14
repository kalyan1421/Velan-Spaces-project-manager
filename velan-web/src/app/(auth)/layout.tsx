import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/app-shell/brand-mark";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Centered card layout for sign-in, invite acceptance and password reset. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">
            <Link
              href="/"
              className="mx-auto mb-6 flex w-fit rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BrandMark size={44} />
              <span className="sr-only">Velan Spaces home</span>
            </Link>
            <div className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10 sm:p-8">{children}</div>
          </div>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
          <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
            Privacy
          </Link>
        </footer>
      </div>
    </Providers>
  );
}
