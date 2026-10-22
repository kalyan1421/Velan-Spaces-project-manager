"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2, MessagesSquare } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { CHAT_PAGE_SIZE, projectOps, projectOpsKeys, type ChatMessage } from "@/lib/api/project-ops";
import { ChatComposer } from "./chat-composer";
import { ChatMessageItem, OutboxMessage, type OutboxItem } from "./chat-message";
import { CHAT_UPLOAD_AREA, chatRefetchInterval, mergeMessages, messageTypeFor } from "./support-model";
import { uploadAttachments } from "./upload-attachments";
import { usePageVisible } from "./use-page-visible";

const NEAR_BOTTOM_PX = 80;
const tempId = () => `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Project chat. The newest page is polled every ~8 s while the tab is visible
 * (React Query `refetchInterval`, paused when hidden or after an access error);
 * older pages are fetched on demand and merged by id.
 */
export function ChatPanel({
  projectId,
  viewerId,
  heightClassName = "h-[min(60dvh,36rem)] min-h-72",
}: {
  projectId: string;
  viewerId: string;
  /** Height of the message list (the composer sits below it). */
  heightClassName?: string;
}) {
  const visible = usePageVisible();
  const queryClient = useQueryClient();
  const key = projectOpsKeys.chat(projectId);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [olderDone, setOlderDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [unseen, setUnseen] = useState(false);

  const latest = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => projectOps.listChat(projectId, { limit: CHAT_PAGE_SIZE }, signal),
    refetchInterval: (query) => chatRefetchInterval({ visible, error: query.state.error }),
    refetchIntervalInBackground: false,
  });

  const messages = useMemo(() => mergeMessages(latest.data ?? [], older), [latest.data, older]);
  const canLoadOlder = !olderDone && (latest.data?.length ?? 0) >= CHAT_PAGE_SIZE;
  const lastId = messages.at(-1)?.id;
  const outboxCount = outbox.length;

  // Keep the view pinned to the newest message unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
      return;
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    else if (lastId) setUnseen(true);
  }, [lastId, outboxCount, older.length]);

  const scrollToBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottom.current = true;
    setUnseen(false);
  };

  const loadOlder = async () => {
    const el = scroller.current;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await projectOps.listChat(projectId, { limit: CHAT_PAGE_SIZE, offset: messages.length });
      if (el) restore.current = { height: el.scrollHeight, top: el.scrollTop };
      setOlder((prev) => mergeMessages(prev, page));
      if (page.length < CHAT_PAGE_SIZE) setOlderDone(true);
    } catch (error) {
      setOlderError(isApiError(error) ? error.message : "Couldn't load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const deliver = useCallback(
    async (item: OutboxItem) => {
      stickToBottom.current = true;
      setOutbox((list) => list.map((o) => (o.id === item.id ? { ...o, status: "sending", error: undefined } : o)));
      try {
        const refs =
          item.refs ??
          (await uploadAttachments(projectId, CHAT_UPLOAD_AREA, item.files, {
            onProgress: (progress) =>
              setOutbox((list) => list.map((o) => (o.id === item.id ? { ...o, progress } : o))),
          }));
        setOutbox((list) => list.map((o) => (o.id === item.id ? { ...o, refs } : o)));
        const saved = await projectOps.sendChat(projectId, {
          content: item.content,
          messageType: messageTypeFor(item.files.map((f) => f.name)),
          ...(refs.length > 0 ? { attachmentUrls: refs } : {}),
        });
        queryClient.setQueryData<ChatMessage[]>(key, (list = []) => [saved, ...list.filter((m) => m.id !== saved.id)]);
        setOutbox((list) => list.filter((o) => o.id !== item.id));
      } catch (error) {
        setOutbox((list) =>
          list.map((o) =>
            o.id === item.id
              ? { ...o, status: "failed", error: isApiError(error) ? error.message : error instanceof Error ? error.message : "Not sent." }
              : o,
          ),
        );
      }
    },
    [projectId, queryClient, key],
  );

  const send = (content: string, files: File[]) => {
    const item: OutboxItem = { id: tempId(), content, files, status: "sending" };
    setOutbox((list) => [...list, item]);
    void deliver(item);
  };

  const forbidden = isApiError(latest.error) && latest.error.status === 403;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
            if (stickToBottom.current) setUnseen(false);
          }}
          className={cn(heightClassName, "overflow-y-auto rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4")}
        >
          {latest.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading messages">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="ml-auto h-12 w-1/2" />
              <Skeleton className="h-12 w-3/5" />
            </div>
          ) : forbidden ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You don&apos;t have access to this chat.</p>
          ) : messages.length === 0 && outbox.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessagesSquare className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-ink">No messages yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">Questions about the work? Send the first message.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {canLoadOlder && (
                <div className="flex flex-col items-center gap-1">
                  <Button variant="outline" size="sm" disabled={loadingOlder} onClick={() => void loadOlder()}>
                    {loadingOlder && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
                    Load older messages
                  </Button>
                  {olderError && <p className="text-xs text-destructive">{olderError}</p>}
                </div>
              )}
              <ol role="log" aria-live="polite" aria-label="Messages" className="flex flex-col gap-3">
                {messages.map((m) => (
                  <ChatMessageItem key={m.id} message={m} own={m.senderId === viewerId} />
                ))}
                {outbox.map((item) => (
                  <OutboxMessage
                    key={item.id}
                    item={item}
                    onRetry={() => void deliver(item)}
                    onDiscard={() => setOutbox((list) => list.filter((o) => o.id !== item.id))}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
        {unseen && (
          <Button size="sm" className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md" onClick={scrollToBottom}>
            <ArrowDown data-icon="inline-start" />
            New messages
          </Button>
        )}
      </div>
      {latest.isError && !forbidden && !latest.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Can&apos;t reach the server right now — retrying automatically.
        </p>
      )}
      {!forbidden && <ChatComposer onSend={send} />}
    </div>
  );
}
