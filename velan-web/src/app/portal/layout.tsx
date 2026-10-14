import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalShell } from "@/components/app-shell/portal-shell";
import { PageSkeleton, TopBarSkeleton } from "@/components/app-shell/shell-skeleton";
import { Providers } from "@/components/providers";
import { toShellUser } from "@/lib/auth/display";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Your project", template: "%s · Velan Spaces" },
  robots: { index: false, follow: false },
};

/** Client portal: clients only; staff are sent to /app by requireRole. */
export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <Providers>
      <Suspense
        fallback={
          <div className="min-h-dvh">
            <TopBarSkeleton />
            <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
              <PageSkeleton rows={3} />
            </div>
          </div>
        }
      >
        <ClientShell>{children}</ClientShell>
      </Suspense>
    </Providers>
  );
}

async function ClientShell({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["client"]);
  return <PortalShell user={toShellUser(user)}>{children}</PortalShell>;
}
