"use client";

import { CircleAlert, CircleCheck, FileText, Film, ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes, type MediaKind, type Rejected } from "./media";
import type { QueueSummary, UploadItem } from "./upload-queue";

const KIND_ICON: Record<MediaKind, typeof FileText> = {
  image: ImageIcon,
  video: Film,
  pdf: FileText,
  document: FileText,
};

function Thumb({ item }: { item: UploadItem }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
      {item.previewUrl ? (
        <Image src={item.previewUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />
      ) : (
        <Icon className="size-5" aria-hidden />
      )}
    </span>
  );
}

function statusText(item: UploadItem): string {
  if (item.status === "done") return "Uploaded";
  if (item.status === "error") return item.error ?? "Upload failed";
  if (item.status === "uploading") return `Uploading… ${Math.round(item.progress * 100)}%`;
  return "Ready to upload";
}

/** Files waiting/uploading for one form, with per-file progress and remove. */
export function UploadQueueList({
  items,
  summary,
  onRemove,
  disabled = false,
  className,
}: {
  items: UploadItem[];
  summary: QueueSummary;
  onRemove: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="sr-only" role="status" aria-live="polite">
        {summary.busy
          ? `Uploading: ${summary.done} of ${summary.total} files done.`
          : summary.failed > 0
            ? `${summary.failed} of ${summary.total} files failed to upload.`
            : summary.allDone
              ? `All ${summary.total} files uploaded.`
              : `${summary.total} ${summary.total === 1 ? "file" : "files"} ready to upload.`}
      </p>
      <ul aria-label="Files to upload" className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-lg bg-card p-2 ring-1 ring-foreground/10",
              item.status === "error" && "ring-destructive/40",
            )}
          >
            <Thumb item={item} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink" title={item.name}>
                {item.name}
              </p>
              <p
                className={cn(
                  "flex items-center gap-1 truncate text-xs",
                  item.status === "error" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {item.status === "done" && <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden />}
                {item.status === "error" && <CircleAlert className="size-3.5 shrink-0" aria-hidden />}
                <span className="truncate">
                  {formatBytes(item.size)} · {statusText(item)}
                </span>
              </p>
              {item.status === "uploading" && (
                <ProgressBar className="mt-1" value={item.progress * 100} label={`Uploading ${item.name}`} showValue={false} />
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || item.status === "uploading"}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name}`}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One toast for everything that couldn't be added. */
export function notifyRejected<F extends { name: string }>(rejected: Rejected<F>[]) {
  if (rejected.length === 0) return;
  if (rejected.length === 1) {
    toast.error(`${rejected[0].file.name} wasn't added`, { description: rejected[0].reason });
    return;
  }
  const reasons = [...new Set(rejected.map((r) => r.reason))];
  toast.error(`${rejected.length} files weren't added`, {
    description: reasons.slice(0, 3).join(" "),
  });
}
