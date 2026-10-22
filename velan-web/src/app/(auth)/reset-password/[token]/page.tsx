import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AccountLinkProblem } from "@/components/staff/account-link-problem";
import { Skeleton } from "@/components/ui/skeleton";
import {
  accountLinkOutcome,
  displayLogin,
  isLinkToken,
  linkStateFromOutcome,
  type LinkState,
  type ResetLinkDetails,
} from "@/lib/api/accounts";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, rawApiFetch } from "@/lib/api/server";
import { ResetPassword } from "./_components/reset-password-form";

// The token lives in this page's URL: never send it to other sites as a Referer.
export const metadata: Metadata = { title: "Reset your password", referrer: "no-referrer" };

export default function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Checking your reset link">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="mx-auto h-4 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <Reset params={params} />
    </Suspense>
  );
}

type Lookup = { ok: true; details: ResetLinkDetails } | { ok: false; state: LinkState };

/** `GET /auth/password-reset/:token` (public). 404 → invalid, 410 → used/expired. */
async function lookupReset(token: string): Promise<Lookup> {
  let res: Response;
  try {
    res = await rawApiFetch(apiUrl(`auth/password-reset/${token}`), { forwardedFor: forwardedFor(await headers()) });
  } catch {
    return { ok: false, state: "error" };
  }
  const body = await readBody(res);
  const outcome = accountLinkOutcome(res.status, upstreamMessage(body));
  if (outcome !== "ok") return { ok: false, state: linkStateFromOutcome(outcome) };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, state: "error" };
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
  return {
    ok: true,
    details: {
      displayName: str(b.displayName),
      // Never show a worker's internal auth address.
      login: displayLogin(str(b.login)),
      expiresAt: str(b.expiresAt),
    },
  };
}

async function Reset({ params }: { params: PageProps<"/reset-password/[token]">["params"] }) {
  const { token } = await params;
  // Validate the shape before calling the API: keeps garbage out of the upstream URL.
  if (!isLinkToken(token)) return <AccountLinkProblem kind="reset" state="invalid" />;

  const result = await lookupReset(token);
  if (!result.ok) return <AccountLinkProblem kind="reset" state={result.state} />;
  return <ResetPassword token={token} details={result.details} />;
}
