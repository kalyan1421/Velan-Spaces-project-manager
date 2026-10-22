"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Eraser,
  Info,
  LifeBuoy,
  ListChecks,
  MailPlus,
  Megaphone,
  MessageSquare,
  PenTool,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { UnreadCount } from "@/lib/api/types";
import {
  type AppNotification,
  countUnread,
  nextUnread,
  type NotificationAudience,
  notificationHref,
  notificationKeys,
  notificationsApi,
  type NotificationType,
  normalizeNotificationType,
  withAllRead,
  without,
  withoutRead,
  withRead,
} from "@/lib/api/notifications";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StateMessage } from "./states";

/** Kept for existing imports; same key as `notificationKeys.list`. */
export const notificationsKey = notificationKeys.list;

const TYPE_META: Record<NotificationType, { icon: LucideIcon; label: string }> = {
  update: { icon: Megaphone, label: "Project update" },
  design: { icon: PenTool, label: "Design" },
  design_approval: { icon: BadgeCheck, label: "Design approval" },
  chat: { icon: MessageSquare, label: "Message" },
  complaint: { icon: LifeBuoy, label: "Complaint" },
  task: { icon: ListChecks, label: "Task" },
  lead: { icon: UserPlus, label: "New lead" },
  invite: { icon: MailPlus, label: "Invitation" },
  system: { icon: Info, label: "Notice" },
};

function typeMeta(type: string | null) {
  const normalized = normalizeNotificationType(type);
  return normalized ? TYPE_META[normalized] : { icon: Bell, label: "Notification" };
}

// ------------------------------------------------------------------ mutations

type Snapshot = { previous?: AppNotification[]; previousCount?: UnreadCount };

/**
 * Shared optimistic plumbing: apply `change` to the cached list (and the unread
 * badge), roll back on error, and refetch both once the last pending
 * notification mutation settles (so overlapping clicks don't flicker).
 */
async function applyOptimistic(
  queryClient: QueryClient,
  change: (list: AppNotification[]) => AppNotification[],
  count?: (previous: UnreadCount | undefined, before?: AppNotification[], after?: AppNotification[]) => UnreadCount | undefined,
): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: notificationKeys.all });
  const previous = queryClient.getQueryData<AppNotification[]>(notificationKeys.list);
  const previousCount = queryClient.getQueryData<UnreadCount>(notificationKeys.unreadCount);
  const next = previous ? change(previous) : undefined;
  if (next) queryClient.setQueryData(notificationKeys.list, next);
  const nextCount = (count ?? nextUnread)(previousCount, previous, next);
  if (nextCount) queryClient.setQueryData(notificationKeys.unreadCount, nextCount);
  return { previous, previousCount };
}

function useNotificationMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  optimistic: (queryClient: QueryClient, vars: TVars) => Promise<Snapshot>,
  errorMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: notificationKeys.all,
    mutationFn,
    onMutate: (vars: TVars) => optimistic(queryClient, vars),
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(notificationKeys.list, context.previous);
      if (context?.previousCount) queryClient.setQueryData(notificationKeys.unreadCount, context.previousCount);
      toast.error(errorMessage);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: notificationKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
    },
  });
}

function useNotificationActions() {
  const markRead = useNotificationMutation(
    (id: string) => notificationsApi.markRead(id),
    (qc, id) => applyOptimistic(qc, (list) => withRead(list, [id])),
    "Couldn't mark as read. Please try again.",
  );
  const markAllRead = useNotificationMutation<void>(
    () => notificationsApi.markAllRead(),
    (qc) => applyOptimistic(qc, withAllRead, (prev) => (prev ? { unread: 0 } : undefined)),
    "Couldn't mark all as read. Please try again.",
  );
  const remove = useNotificationMutation(
    (id: string) => notificationsApi.remove(id),
    (qc, id) => applyOptimistic(qc, (list) => without(list, id)),
    "Couldn't delete the notification. Please try again.",
  );
  const clearRead = useNotificationMutation<void>(
    () => notificationsApi.clearRead(),
    (qc) => applyOptimistic(qc, withoutRead),
    "Couldn't clear read notifications. Please try again.",
  );
  return { markRead, markAllRead, remove, clearRead };
}

// ------------------------------------------------------------------ list

export function NotificationsList({
  initial,
  audience = "staff",
}: {
  initial: AppNotification[];
  /** Staff rows link into `/app`, client rows into `/portal`. */
  audience?: NotificationAudience;
}) {
  const { data = initial } = useQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ signal }) => notificationsApi.list(signal),
    initialData: initial,
    refetchInterval: 60_000,
  });
  const { markRead, markAllRead, remove, clearRead } = useNotificationActions();
  const [confirmClear, setConfirmClear] = useState(false);
  const unread = countUnread(data);
  const readCount = data.length - unread;

  if (data.length === 0) {
    return (
      <StateMessage
        icon={BellRing}
        title="You're all caught up"
        description={
          audience === "staff"
            ? "New leads, updates, designs, messages, complaints and task assignments will appear here."
            : "Updates, designs and replies about your projects will appear here."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread > 0 ? `${unread} unread` : "No unread notifications"}
        </p>
        <div className="flex flex-wrap gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <CheckCheck aria-hidden />
              Mark all as read
            </Button>
          )}
          {readCount > 0 && (
            <Button variant="ghost" size="sm" disabled={clearRead.isPending} onClick={() => setConfirmClear(true)}>
              <Eraser aria-hidden />
              Clear read
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {data.map((n) => (
          <NotificationRow
            key={n.id}
            notification={n}
            href={notificationHref(n, audience)}
            onOpen={() => !n.isRead && markRead.mutate(n.id)}
            onMarkRead={() => markRead.mutate(n.id)}
            onDelete={() => remove.mutate(n.id)}
          />
        ))}
      </ul>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear read notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              {readCount === 1 ? "1 read notification" : `${readCount} read notifications`} will be removed from this
              list. Unread ones stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                clearRead.mutate();
                setConfirmClear(false);
              }}
            >
              Clear read
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NotificationRow({
  notification: n,
  href,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  notification: AppNotification;
  href: string | null;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const title = n.title?.trim() || "Notification";
  const { icon: Icon, label } = typeMeta(n.type);

  return (
    <li className="relative flex items-start gap-3 px-4 py-3 transition-colors has-[a:hover]:bg-muted/50">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          n.isRead ? "bg-muted text-muted-foreground" : "bg-gold/20 text-ink",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", n.isRead ? "text-foreground" : "font-semibold text-ink")}>
          <span className="sr-only">{label}: </span>
          {href ? (
            // Stretched link: the whole row is clickable; the action buttons sit above it.
            <Link
              href={href}
              onClick={onOpen}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
            >
              {title}
            </Link>
          ) : (
            title
          )}
          {!n.isRead && <span className="sr-only"> (unread)</span>}
        </p>
        {n.body && <p className="mt-0.5 text-sm break-words text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {n.projectName && <span>{n.projectName} · </span>}
          <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} suppressHydrationWarning>
            {formatRelative(n.createdAt)}
          </time>
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-0.5 self-center">
        {!n.isRead && (
          <span aria-hidden className="mr-1.5 size-2 rounded-full bg-gold" />
        )}
        {!n.isRead && (
          <Button variant="ghost" size="icon-sm" aria-label={`Mark "${title}" as read`} title="Mark as read" onClick={onMarkRead}>
            <Check aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete notification "${title}"`}
          title="Delete"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
