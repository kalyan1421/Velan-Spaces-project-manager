import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsList } from "@/components/app-shell/notifications-list";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { apiFetch } from "@/lib/api/server";
import type { Notification } from "@/lib/api/types";

export const metadata: Metadata = { title: "Notifications" };

export default function PortalNotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Notifications" />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <PortalNotifications />
      </Suspense>
    </div>
  );
}

async function PortalNotifications() {
  const list = await apiFetch<Notification[] | null>("notifications");
  return <NotificationsList initial={Array.isArray(list) ? list : []} projectBasePath="/portal/projects" />;
}
