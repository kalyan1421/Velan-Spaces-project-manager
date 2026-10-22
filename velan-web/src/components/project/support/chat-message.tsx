import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ChatMessage } from "@/lib/api/project-ops";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttachmentList } from "./attachments";
import { senderRoleLabel } from "./support-model";

function Bubble({ own, children }: { own: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-2 rounded-2xl px-3 py-2 text-sm sm:max-w-[70%]",
        own ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm bg-muted text-ink",
      )}
    >
      {children}
    </div>
  );
}

export function ChatMessageItem({ message, own }: { message: ChatMessage; own: boolean }) {
  const role = senderRoleLabel(message.senderRole);
  const name = own ? "You" : message.senderName?.trim() || role || "Team";
  return (
    <li className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")}>
      <p className="px-1 text-xs text-muted-foreground">
        <span className="font-medium text-ink">{name}</span>
        {!own && role && name !== role ? ` · ${role}` : null}
        {" · "}
        <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>
          {formatRelative(message.createdAt)}
        </time>
      </p>
      <Bubble own={own}>
        {message.content ? <p className="break-words whitespace-pre-line">{message.content}</p> : null}
        <AttachmentList urls={message.attachmentUrls ?? []} tone={own ? "inverted" : "default"} />
      </Bubble>
    </li>
  );
}

export type OutboxItem = {
  id: string;
  content: string;
  files: File[];
  /** Uploaded refs, kept so a retry doesn't upload again. */
  refs?: string[];
  status: "sending" | "failed";
  progress?: number;
  error?: string;
};

/** A message on its way (or failed) — shown at the bottom until the server confirms it. */
export function OutboxMessage({
  item,
  onRetry,
  onDiscard,
}: {
  item: OutboxItem;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const uploading = item.files.length > 0 && !item.refs && item.status === "sending";
  return (
    <li className="flex flex-col items-end gap-1">
      <Bubble own>
        {item.content ? <p className="break-words whitespace-pre-line">{item.content}</p> : null}
        {item.files.length > 0 && (
          <p className="text-xs text-white/80">
            {item.files.length} {item.files.length === 1 ? "attachment" : "attachments"}
          </p>
        )}
      </Bubble>
      {item.status === "sending" ? (
        <p className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          {uploading ? `Uploading… ${Math.round((item.progress ?? 0) * 100)}%` : "Sending…"}
        </p>
      ) : (
        <p className="inline-flex flex-wrap items-center justify-end gap-x-2 px-1 text-xs text-destructive">
          <AlertCircle className="size-3.5" aria-hidden />
          {item.error ?? "Not sent."}
          <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
            Retry
          </button>
          <button type="button" onClick={onDiscard} className="font-medium text-muted-foreground underline underline-offset-2">
            Discard
          </button>
        </p>
      )}
    </li>
  );
}
