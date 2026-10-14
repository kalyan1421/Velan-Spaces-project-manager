import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { AppShellSkeleton } from "@/components/app-shell/shell-skeleton";
import { Providers } from "@/components/providers";
import { SIDEBAR_COOKIE } from "@/lib/api/cookies";
import { toShellUser } from "@/lib/auth/display";
import { requireRole } from "@/lib/auth/session";
import { navFor } from "@/lib/nav";

export const metadata: Metadata = {
  title: { default: "App", template: "%s · Velan Spaces" },
  robots: { index: false, follow: false },
};

/**
 * Staff shell (head / manager / worker). The session check streams in behind
 * Suspense so the skeleton is part of the prerendered static shell.
 */
export default function StaffLayout({ children }: LayoutProps<"/app">) {
  return (
    <Providers>
      <Suspense fallback={<AppShellSkeleton />}>
        <StaffShell>{children}</StaffShell>
      </Suspense>
    </Providers>
  );
}

async function StaffShell({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["head", "manager", "worker"]);
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <AppShell user={toShellUser(user)} nav={navFor(user.role)} initialCollapsed={collapsed}>
      {children}
    </AppShell>
  );
}
