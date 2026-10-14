import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "cn";

/*
 * Visual language of the public site
 * - ink (#1A1A2E) for text and primary actions; deep (#16213E) for dark bands
 * - sun (#FFE566) / gold (#FFB347) only as fills and accents — never as text on white
 * - Outfit throughout: light (300) display sizes echo the thin line-art of the logo
 */

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)} {...props} />;
}

/** Small uppercase label with a short gold rule. */
export function Eyebrow({ children, className, tone = "light" }: { children: ReactNode; className?: string; tone?: "light" | "dark" }) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em]",
        tone === "light" ? "text-ink/70" : "text-white/75",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-8 bg-gold" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  tone = "light",
  className,
  as: Heading = "h2",
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <Heading
        id={id}
        className={cn(
          "font-heading font-light tracking-[-0.02em] text-balance",
          Heading === "h1" ? "text-4xl leading-[1.05] sm:text-5xl lg:text-6xl" : "text-3xl leading-[1.1] sm:text-4xl lg:text-[2.75rem]",
          eyebrow ? "mt-4" : null,
          tone === "light" ? "text-ink" : "text-white",
        )}
      >
        {title}
      </Heading>
      {intro ? (
        <p className={cn("mt-5 text-base leading-relaxed text-pretty sm:text-lg", tone === "light" ? "text-ink/75" : "text-white/80")}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/** Warm "light falling on the words" highlight used once per headline. */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="box-decoration-clone bg-[linear-gradient(transparent_62%,var(--color-sun,#FFE566)_62%,var(--color-sun,#FFE566)_92%,transparent_92%)] px-1">
      {children}
    </span>
  );
}

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: cn(buttonBase, "bg-ink text-white hover:bg-deep focus-visible:outline-ink"),
  secondary: cn(buttonBase, "border border-ink/25 bg-white text-ink hover:border-ink hover:bg-canvas focus-visible:outline-ink"),
  sun: cn(buttonBase, "bg-sun text-ink hover:bg-gold focus-visible:outline-sun"),
  ghostDark: cn(buttonBase, "border border-white/30 text-white hover:border-white hover:bg-white/10 focus-visible:outline-sun"),
} as const;

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cn(buttonStyles[variant], className)} {...props} />;
}

/** Inline text link with an underline that thickens on hover. */
export const textLinkStyles =
  "font-medium text-ink underline decoration-gold decoration-2 underline-offset-4 transition-[text-decoration-thickness] hover:decoration-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
