import { Clock, Link2Off, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { SupportLink } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";
import type { LinkState } from "@/lib/api/accounts";

type Kind = "invite" | "reset";

const ASK: Record<Kind, string> = {
  invite: "Ask the Velan Spaces team to send you a new invite.",
  reset: "Ask your administrator for a new reset link.",
};

const COPY: Record<LinkState, { icon: LucideIcon; title: (kind: Kind) => string; body: (kind: Kind) => string }> = {
  invalid: {
    icon: Link2Off,
    title: (k) => (k === "invite" ? "This invite link doesn't work" : "This reset link doesn't work"),
    body: (k) => `It may have been copied incompletely. ${ASK[k]}`,
  },
  expired: {
    icon: Clock,
    title: (k) => (k === "invite" ? "This invite link has expired" : "This reset link has expired"),
    body: (k) => `Links expire for your security. ${ASK[k]}`,
  },
  used: {
    icon: Link2Off,
    title: (k) => (k === "invite" ? "This invite has already been used" : "This reset link has already been used"),
    body: (k) =>
      k === "invite"
        ? "If you set up your account already, sign in with your email and password."
        : `Each link works once. If you just set a new password, sign in with it. Otherwise: ${ASK[k].toLowerCase()}`,
  },
  error: {
    icon: TriangleAlert,
    title: () => "We couldn't open this link",
    body: () => "This is usually temporary. Please try again in a few minutes.",
  },
};

/** Dead end for invalid / expired / used invite and reset links, with the support contact. */
export function AccountLinkProblem({ kind, state }: { kind: Kind; state: LinkState }) {
  const copy = COPY[state];
  const Icon = copy.icon;
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <span className="grid size-11 place-items-center rounded-full bg-gold/20 text-ink">
        <Icon className="size-5" aria-hidden />
      </span>
      <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">{copy.title(kind)}</h1>
      <p className="text-sm text-muted-foreground">{copy.body(kind)}</p>
      <p className="text-sm text-muted-foreground">
        Need help? Email <SupportLink />.
      </p>
      <Link href="/login" className={buttonVariants({ variant: "outline", className: "h-10 w-full" })}>
        Go to sign in
      </Link>
    </div>
  );
}
