"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { UnreadCount } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const unreadCountKey = ["notifications", "unread-count"] as const;

/**
 * Unread badge, polled every 60 s. TanStack Query pauses interval refetches
 * while the tab is hidden and refetches on focus (R-F1).
 */
export function NotificationsBell({ href = "/app/notifications" }: { href?: string }) {
  const { data } = useQuery({
    queryKey: unreadCountKey,
    queryFn: ({ signal }) => api.get<UnreadCount>("notifications/unread-count", { signal }),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const unread = Math.max(0, data?.unread ?? 0);
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative size-9")}
    >
      <Bell className="size-[18px]" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] leading-none font-semibold text-ink ring-2 ring-background"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
