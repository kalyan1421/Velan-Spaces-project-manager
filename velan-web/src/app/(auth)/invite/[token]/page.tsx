import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AccountLinkProblem } from "@/components/staff/account-link-problem";
import { Skeleton } from "@/components/ui/skeleton";
import {
  accountLinkOutcome,
  isLinkToken,
  linkStateFromOutcome,
  type InviteLinkDetails,
  type LinkState,
} from "@/lib/api/accounts";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, rawApiFetch } from "@/lib/api/server";
import { AcceptInvite } from "./_components/accept-invite-form";

// The token lives in this page's URL: never send it to other sites as a Referer.
export const metadata: Metadata = { title: "Accept your invite", referrer: "no-referrer" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your invite">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <Invite params={params} />
    </Suspense>
  );
}

type Lookup = { ok: true; invite: InviteLinkDetails } | { ok: false; state: LinkState };

/** `GET /auth/invites/:token` (public). 404 → invalid, 410 → used/expired. */
async function lookupInvite(token: string): Promise<Lookup> {
  let res: Response;
  try {
    res = await rawApiFetch(apiUrl(`auth/invites/${token}`), { forwardedFor: forwardedFor(await headers()) });
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
    invite: {
      email: str(b.email),
      displayName: str(b.displayName),
      projectName: str(b.projectName),
      expiresAt: str(b.expiresAt),
    },
  };
}

async function Invite({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  // Validate the shape before calling the API: keeps garbage out of the upstream URL.
  if (!isLinkToken(token)) return <AccountLinkProblem kind="invite" state="invalid" />;

  const result = await lookupInvite(token);
  if (!result.ok) return <AccountLinkProblem kind="invite" state={result.state} />;
  return <AcceptInvite token={token} invite={result.invite} />;
}
