import Link from "next/link";
import { SupportLink } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";
import type { LinkProblem } from "@/lib/auth/links";

const COPY: Record<"invite" | "reset", Record<LinkProblem, { title: string; body: string }>> = {
  invite: {
    invalid: {
      title: "This invite link doesn't work",
      body: "It may have been used already or copied incompletely. Ask us to send a new one.",
    },
    expired: { title: "This invite link has expired", body: "Invite links expire for your security. Ask us to send a new one." },
    unavailable: {
      title: "Invites can't be accepted online yet",
      body: "We're still switching this on. Please contact us and we'll set up your access.",
    },
    error: { title: "We couldn't load your invite", body: "This is usually temporary. Please try again in a few minutes." },
  },
  reset: {
    invalid: {
      title: "This reset link doesn't work",
      body: "It may have been used already or copied incompletely. Ask your administrator for a new one.",
    },
    expired: { title: "This reset link has expired", body: "Reset links expire for your security. Ask your administrator for a new one." },
    unavailable: {
      title: "Password reset isn't available online yet",
      body: "Please ask your administrator to reset your password.",
    },
    error: { title: "Something went wrong", body: "This is usually temporary. Please try again in a few minutes." },
  },
};

/** Friendly dead-end for bad/expired/unavailable invite and reset links, with support contact. */
export function LinkProblemMessage({ kind, problem }: { kind: "invite" | "reset"; problem: LinkProblem }) {
  const copy = COPY[kind][problem];
  return (
    <div className="space-y-4 text-center" role="status">
      <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      <p className="text-sm text-muted-foreground">
        Need help? Email <SupportLink />.
      </p>
      <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
        Go to sign in
      </Link>
    </div>
  );
}
