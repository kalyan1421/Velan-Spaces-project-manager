import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { readSessionTokens } from "@/lib/api/session";
import { refreshUrl, safeNextPath } from "@/lib/auth/redirects";
import { postLoginRedirect } from "@/lib/auth/roles";
import { getSessionState } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { AuthHeading } from "../_components/auth-heading";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  expired: "Your session has ended. Please sign in again.",
  suspended: "Your account is suspended. Please contact the administrator.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <AuthHeading title="Sign in to Velan Spaces" description="For the Velan Spaces team and our clients." />
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/** Signed-in visitors go straight to their landing page; everyone else gets the form. */
async function LoginGate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const reason = typeof params.reason === "string" ? params.reason : null;

  const { accessToken, refreshToken } = await readSessionTokens();
  // An expired access cookie with a live refresh cookie: rotate, then continue to `next`.
  if (!accessToken && refreshToken && !reason) redirect(refreshUrl(next ?? "/app"));

  if (accessToken) {
    let state: Awaited<ReturnType<typeof getSessionState>> | null = null;
    try {
      state = await getSessionState();
    } catch (error) {
      // Redirects must propagate; an unreachable API just shows the form.
      unstable_rethrow(error);
    }
    if (state?.status === "signed-in") redirect(postLoginRedirect(state.user.role, next));
    if (state?.status === "suspended") return renderForm(next, NOTICES.suspended);
  }

  return renderForm(next, reason ? (NOTICES[reason] ?? null) : null);
}

function renderForm(next: string | null, notice: string | null) {
  // Read at request time so one Docker image works in every environment.
  const googleClientId = getEnv().NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null;
  return <LoginForm next={next} notice={notice} googleClientId={googleClientId} />;
}
