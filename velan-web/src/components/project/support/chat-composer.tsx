"use client";

import { Paperclip, SendHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_MESSAGE_MAX } from "@/lib/api/project-ops";
import { cn } from "@/lib/utils";
import { PendingAttachments } from "./attachments";
import { ATTACHMENT_ACCEPT, acceptAttachments } from "./support-model";

/**
 * Message box: Enter sends, Shift+Enter adds a line. Attach with the button,
 * by pasting a screenshot, or by dropping files onto the box (images / PDF).
 */
export function ChatComposer({ onSend }: { onSend: (content: string, files: File[]) => void }) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const tooLong = text.length > CHAT_MESSAGE_MAX;
  const canSend = (text.trim() !== "" || files.length > 0) && !tooLong;

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const result = acceptAttachments(files, incoming);
    setFiles(result.files);
    setErrors(result.errors);
  };

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
    setErrors([]);
  };

  return (
    <form
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-2 transition-colors focus-within:border-ring",
        dragging && "border-gold bg-gold/5",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <label htmlFor={`${id}-message`} className="sr-only">
        Message
      </label>
      <Textarea
        id={`${id}-message`}
        value={text}
        rows={2}
        placeholder="Write a message…"
        className="max-h-48 min-h-12 resize-none border-0 bg-transparent px-1.5 shadow-none focus-visible:ring-0"
        aria-invalid={tooLong ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files);
          if (pasted.length > 0) {
            e.preventDefault();
            addFiles(pasted);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <PendingAttachments files={files} onRemove={(i) => setFiles((list) => list.filter((_, idx) => idx !== i))} />
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 px-1 text-xs font-medium text-destructive">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
            <Paperclip data-icon="inline-start" />
            Attach
          </Button>
          <p id={`${id}-hint`} className={cn("hidden text-xs text-muted-foreground sm:block", tooLong && "block text-destructive")}>
            {tooLong
              ? `Messages can be up to ${CHAT_MESSAGE_MAX} characters.`
              : "Enter to send · Shift+Enter for a new line · paste or drop images/PDF"}
          </p>
        </div>
        <Button type="submit" disabled={!canSend}>
          <SendHorizontal data-icon="inline-start" />
          Send
        </Button>
      </div>
    </form>
  );
}
