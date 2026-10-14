import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { SupportLink } from "@/components/app-shell/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { displayNameOf } from "@/lib/auth/display";
import { roleLabel } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "./_components/change-password-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile" description="Your account, password and help." />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium text-ink sm:col-span-2">{value}</dd>
    </div>
  );
}

async function ProfileContent() {
  const user = await getSession();
  if (!user) return null; // the layout already redirected

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Name" value={displayNameOf(user)} />
            {user.email && <Row label="Email" value={user.email} />}
            {user.username && <Row label="Username" value={user.username} />}
            <Row label="Role" value={roleLabel(user.role)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You&apos;ll stay signed in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm canChange={Boolean(user.email)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Help</CardTitle>
          <CardDescription>
            Questions or problems? Email <SupportLink />.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
