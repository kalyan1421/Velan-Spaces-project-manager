import Image from "next/image";
import Link from "next/link";

import { ButtonLink, textLinkStyles } from "@/components/marketing/primitives";

export default function PortfolioItemNotFound() {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <Image
        src="/marketing/empty-portfolio.svg"
        alt=""
        width={480}
        height={360}
        unoptimized
        className="mx-auto w-full max-w-xs"
      />
      <h1 className="mt-8 font-heading text-3xl font-light tracking-[-0.02em] text-ink sm:text-4xl">
        We couldn&apos;t find that project
      </h1>
      <p className="mt-4 leading-relaxed text-ink/75">
        It may have been renamed or taken down. Browse the rest of our work, or tell us what you&apos;re planning.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
        <ButtonLink href="/portfolio">See all projects</ButtonLink>
        <Link href="/contact#enquiry" className={textLinkStyles}>
          Get a call back
        </Link>
      </div>
    </div>
  );
}
