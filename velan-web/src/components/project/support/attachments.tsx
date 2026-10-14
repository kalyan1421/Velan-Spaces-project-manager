"use client";

import { FileText, Paperclip, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { attachmentKind, attachmentName } from "./support-model";

/** Attachments of a sent message/complaint. URLs are short-lived signed URLs: open, never store. */
export function AttachmentList({ urls, className, tone = "default" }: { urls: string[]; className?: string; tone?: "default" | "inverted" }) {
  if (urls.length === 0) return null;
  const images = urls.filter((u) => attachmentKind(u) === "image");
  const files = urls.filter((u) => attachmentKind(u) !== "image");
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((url) => (
            <li key={url.split("?")[0]}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Image
                  src={url}
                  alt={attachmentName(url)}
                  width={160}
                  height={120}
                  unoptimized
                  className="h-28 w-36 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((url) => (
            <li key={url.split("?")[0]}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-md text-sm underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tone === "inverted" ? "text-white" : "text-ink",
                )}
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{attachmentName(url)}</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Files picked but not sent yet, each removable. */
export function PendingAttachments({
  files,
  onRemove,
  disabled,
}: {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <ul aria-label="Attachments to send" className="flex flex-wrap gap-1.5">
      {files.map((file, i) => (
        <li
          key={`${file.name}-${file.size}-${file.lastModified}-${i}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-xs text-ink"
        >
          <Paperclip className="size-3.5 shrink-0" aria-hidden />
          <span className="max-w-48 truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => onRemove(i)}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
