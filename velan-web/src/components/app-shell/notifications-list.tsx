"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { Notification, UnreadCount } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { unreadCountKey } from "./notifications-bell";
import { StateMessage } from "./states";

export const notificationsKey = ["notifications", "list"] as const;

function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.patch(`notifications/${id}/read`))),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey });
      const previous = queryClient.getQueryData<Notification[]>(notificationsKey);
      const previousCount = queryClient.getQueryData<UnreadCount>(unreadCountKey);
      queryClient.setQueryData<Notification[]>(notificationsKey, (list) =>
        list?.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)),
      );
      if (previousCount) {
        queryClient.setQueryData<UnreadCount>(unreadCountKey, {
          unread: Math.max(0, previousCount.unread - ids.length),
        });
      }
      return { previous, previousCount };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(notificationsKey, context.previous);
      if (context?.previousCount) queryClient.setQueryData(unreadCountKey, context.previousCount);
      toast.error("Couldn't mark as read. Please try again.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
}

export function NotificationsList({
  initial,
  projectBasePath = "/app/projects",
}: {
  initial: Notification[];
  /** Where a notification's project links to: staff app or client portal. */
  projectBasePath?: "/app/projects" | "/portal/projects";
}) {
  const { data = initial } = useQuery({
    queryKey: notificationsKey,
    queryFn: ({ signal }) => api.get<Notification[]>("notifications", { signal }),
    initialData: initial,
    refetchInterval: 60_000,
  });
  const markRead = useMarkRead();
  const unread = data.filter((n) => !n.isRead);

  if (data.length === 0) {
    return (
      <StateMessage
        icon={BellRing}
        title="You're all caught up"
        description="Updates, designs, complaints and messages for your projects will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread.length > 0 ? `${unread.length} unread` : "No unread notifications"}
        </p>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(unread.map((n) => n.id))}
          >
            <CheckCheck aria-hidden />
            Mark all as read
          </Button>
        )}
      </div>

      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {data.map((n) => {
          const title = n.title?.trim() || "Notification";
          const content = (
            <>
              <span
                aria-hidden
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-gold")}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", n.isRead ? "text-foreground" : "font-semibold text-ink")}>
                  {title}
                  {!n.isRead && <span className="sr-only"> (unread)</span>}
                </span>
                {n.body && <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {n.projectName && <span>{n.projectName} · </span>}
                  <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} suppressHydrationWarning>
                    {formatRelative(n.createdAt)}
                  </time>
                </span>
              </span>
            </>
          );

          return (
            <li key={n.id} className="relative">
              {n.projectId ? (
                <Link
                  href={`${projectBasePath}/${n.projectId}`}
                  onClick={() => !n.isRead && markRead.mutate([n.id])}
                  className="flex gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex gap-3 px-4 py-3">
                  {content}
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 self-center"
                      onClick={() => markRead.mutate([n.id])}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
