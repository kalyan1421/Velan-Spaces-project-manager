"use client";

import { MessageSquare, Send } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectUpdate } from "@/lib/api/project-content";
import { roleLabel } from "@/lib/auth/roles";
import { formatDateTime, formatRelative } from "@/lib/format";
import { MAX_COMMENT_TEXT } from "./update-meta";

/** Comment thread under an update. Clients see it read-only (mobile parity). */
export function UpdateComments({
  update,
  canComment,
  onAddComment,
}: {
  update: ProjectUpdate;
  canComment: boolean;
  onAddComment: (update: ProjectUpdate, text: string) => Promise<boolean>;
}) {
  const count = update.comments.length;
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const panelId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (count === 0 && !canComment) return null;

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const ok = await onAddComment(update, value);
    setSending(false);
    if (ok) {
      setText("");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="mt-4 border-t pt-3">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => {
          setExpanded((v) => !v);
          if (!expanded && canComment) requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <MessageSquare data-icon="inline-start" aria-hidden />
        {count === 0 ? "Comment" : `${count} ${count === 1 ? "comment" : "comments"}`}
      </Button>

      {expanded && (
        <div id={panelId} className="mt-2 flex flex-col gap-3">
          {count > 0 && (
            <ol className="flex flex-col gap-2.5" aria-label="Comments">
              {update.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                    <span className="text-sm font-medium text-ink">{c.authorName}</span>
                    {c.role && <span>{roleLabel(c.role)}</span>}
                    {c.createdAt && (
                      <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)} suppressHydrationWarning>
                        {formatRelative(c.createdAt)}
                      </time>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{c.text}</p>
                </li>
              ))}
            </ol>
          )}

          {canComment && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor={inputId} className="sr-only">
                Add a comment
              </label>
              <Textarea
                id={inputId}
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={MAX_COMMENT_TEXT}
                placeholder="Add a comment…"
                className="min-h-9 flex-1 resize-y"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={sending || text.trim() === ""} aria-label="Send comment">
                <Send aria-hidden />
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
