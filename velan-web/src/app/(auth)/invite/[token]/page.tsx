import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, rawApiFetch } from "@/lib/api/server";
import type { InviteDetails } from "@/lib/api/types";
import { isExpired, isValidLinkToken, linkProblemFrom, type LinkProblem } from "@/lib/auth/links";
import { AuthHeading } from "../../_components/auth-heading";
import { LinkProblemMessage } from "../../_components/link-problem";
import { AcceptInviteForm } from "./_components/accept-invite-form";

export const metadata: Metadata = { title: "Accept your invite" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="mx-auto h-6 w-48" />
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

type InviteResult = { ok: true; invite: InviteDetails } | { ok: false; problem: LinkProblem };

async function fetchInvite(token: string): Promise<InviteResult> {
  try {
    const res = await rawApiFetch(apiUrl(`auth/invites/${encodeURIComponent(token)}`), {
      forwardedFor: forwardedFor(await headers()),
    });
    const body = await readBody(res);
    if (!res.ok) return { ok: false, problem: linkProblemFrom(res.status, upstreamMessage(body)) };
    if (!body || typeof body !== "object") return { ok: false, problem: "error" };
    return { ok: true, invite: body as InviteDetails };
  } catch {
    return { ok: false, problem: "error" };
  }
}

async function Invite({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  if (!isValidLinkToken(token)) return <LinkProblemMessage kind="invite" problem="invalid" />;

  const result = await fetchInvite(token);
  if (!result.ok) return <LinkProblemMessage kind="invite" problem={result.problem} />;

  const { invite } = result;
  if (isExpired(invite.expiresAt, new Date())) return <LinkProblemMessage kind="invite" problem="expired" />;

  if (invite.accountExists) {
    return (
      <>
        <AuthHeading
          title="You already have an account"
          description={
            <>
              {invite.projectName ? <>You&apos;ve been added to {invite.projectName}. </> : null}
              Sign in with your existing password{invite.email ? ` (${invite.email})` : ""}.
            </>
          }
        />
        <Link href="/login" className={buttonVariants({ size: "lg", className: "h-10 w-full" })}>
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Welcome to Velan Spaces"
        description={
          invite.projectName
            ? `Create your account to follow ${invite.projectName}.`
            : "Create your account to follow your project."
        }
      />
      <AcceptInviteForm token={token} email={invite.email} displayName={invite.displayName} />
    </>
  );
}
