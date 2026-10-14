import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { site } from "../../content/site";
import { Container } from "./primitives";
import { ActiveSiteNav, SiteNav } from "./site-nav";

export function BrandMark({ className }: { className?: string }) {
  // The logo PNG has generous white padding; scale it inside a clipped box so
  // the line drawing reads at header size.
  return (
    <span className={className ?? "relative block size-11 overflow-hidden rounded-xl bg-white"}>
      <Image
        src="/brand/logo.png"
        alt=""
        width={64}
        height={64}
        className="absolute left-1/2 top-1/2 size-16 max-w-none -translate-x-1/2 -translate-y-1/2"
        loading="eager"
      />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <Container className="relative flex h-16 items-center justify-between gap-4 md:h-[72px]">
        <Link
          href="/"
          className="-ml-1 flex items-center gap-2.5 rounded-xl pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <BrandMark />
          <span className="font-heading text-lg font-medium tracking-[-0.01em] text-ink">{site.name}</span>
          <span className="sr-only">— home</span>
        </Link>
        {/* The active-link highlight reads the current segment, which is only
            known at request time on not-yet-generated portfolio pages. */}
        <Suspense fallback={<SiteNav segment="" />}>
          <ActiveSiteNav />
        </Suspense>
      </Container>
    </header>
  );
}
