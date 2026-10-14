import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isValidLinkToken } from "@/lib/auth/links";
import { AuthHeading } from "../../_components/auth-heading";
import { LinkProblemMessage } from "../../_components/link-problem";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <Reset params={params} />
    </Suspense>
  );
}

async function Reset({ params }: { params: PageProps<"/reset-password/[token]">["params"] }) {
  const { token } = await params;
  if (!isValidLinkToken(token)) return <LinkProblemMessage kind="reset" problem="invalid" />;
  return (
    <>
      <AuthHeading title="Set a new password" description="Choose a new password for your Velan Spaces account." />
      <ResetPasswordForm token={token} />
    </>
  );
}
