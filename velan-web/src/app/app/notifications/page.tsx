import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { apiFetch } from "@/lib/api/server";
import type { AppNotification } from "@/lib/api/notifications";
import { NotificationsList } from "@/components/app-shell/notifications-list";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Notifications" description="The latest 100 notifications for your account." />
      <Suspense fallback={<PageSkeleton rows={5} />}>
        <NotificationsContent />
      </Suspense>
    </div>
  );
}

async function NotificationsContent() {
  const list = await apiFetch<AppNotification[] | null>("notifications");
  return <NotificationsList initial={Array.isArray(list) ? list : []} audience="staff" />;
}
