"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isApiError } from "@/lib/api/errors";
import { filesFromClipboard, namePastedFile } from "./dropped-files";
import type { FilePlan } from "./media";
import { UploadDropzone } from "./upload-dropzone";
import type { UploadItem } from "./upload-queue";
import { UploadQueueList, notifyRejected } from "./upload-queue-list";
import { useUploadQueue, type UploadTarget, type UploadedItem } from "./use-upload-queue";

type Stage = "idle" | "uploading" | "saving";

/**
 * Multi-file upload that creates one record per file (designs, files).
 * Uploads first; then saves each uploaded file once. A retry re-uploads only
 * failed files and saves only unsaved ones, so nothing is duplicated.
 */
export function BatchUploadDialog({
  open,
  onOpenChange,
  title,
  description,
  target,
  accept,
  plan,
  dropTitle,
  dropHint,
  fields,
  noun,
  saveItem,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  target: UploadTarget;
  accept: string;
  /** Accept/reject newly picked files given what's already queued. */
  plan: (queued: UploadItem[], files: File[]) => FilePlan<File>;
  dropTitle: string;
  dropHint: ReactNode;
  /** Extra form fields (title, type…), rendered above the drop zone. */
  fields?: (disabled: boolean) => ReactNode;
  /** Singular noun for messages: "design", "file". */
  noun: string;
  /** Create the record for one uploaded file. Throw to mark it failed. */
  saveItem: (uploaded: UploadedItem, index: number, all: UploadedItem[]) => Promise<void>;
  /** Called after every file is saved, with how many. */
  onSaved: (count: number) => Promise<void> | void;
}) {
  const queue = useUploadQueue(target);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(new Set<string>());
  const busy = stage !== "idle";
  const { summary } = queue;
  const plural = (n: number) => `${n} ${n === 1 ? noun : `${noun}s`}`;

  const addFiles = (files: File[]) => {
    const result = plan(queue.items, files);
    queue.add(result.accepted);
    notifyRejected(result.rejected);
    if (result.accepted.length > 0) setError(null);
  };

  const resetAll = () => {
    queue.reset();
    saved.current = new Set();
    setError(null);
  };

  const submit = async () => {
    if (busy || queue.items.length === 0) return;
    setError(null);
    setStage("uploading");
    const uploaded = await queue.upload();
    if (!uploaded) {
      setStage("idle");
      setError("Some files didn't upload. Retry, or remove them to continue.");
      return;
    }
    setStage("saving");
    let failed = 0;
    let lastError: string | null = null;
    for (let i = 0; i < uploaded.length; i += 1) {
      const u = uploaded[i];
      if (saved.current.has(u.item.id)) continue;
      try {
        await saveItem(u, i, uploaded);
        saved.current.add(u.item.id);
      } catch (e) {
        failed += 1;
        lastError = isApiError(e) ? e.message : null;
      }
    }
    setStage("idle");
    if (failed > 0) {
      setError(`${plural(failed)} couldn't be saved${lastError ? ` (${lastError})` : ""}. Try again.`);
      return;
    }
    const count = uploaded.length;
    resetAll();
    onOpenChange(false);
    await onSaved(count);
  };

  const label =
    stage === "uploading"
      ? `Uploading ${summary.done}/${summary.total}…`
      : stage === "saving"
        ? "Saving…"
        : error
          ? "Try again"
          : queue.items.length > 0
            ? `Upload ${plural(queue.items.length)}`
            : "Upload";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't drop an upload in progress by clicking outside / pressing Esc.
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          id={`${target.area}-upload-form`}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          onPaste={(e) => {
            if (busy) return;
            const files = filesFromClipboard(e.clipboardData);
            if (files.length === 0) return;
            e.preventDefault();
            addFiles(files.map((f, i) => namePastedFile(f, i)));
          }}
        >
          {fields?.(busy)}
          <UploadDropzone accept={accept} disabled={busy} onFiles={addFiles} title={dropTitle} hint={dropHint} />
          <UploadQueueList items={queue.items} summary={summary} onRemove={queue.remove} disabled={busy} />
          {stage === "uploading" && <ProgressBar value={summary.progress * 100} label="Overall upload progress" />}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {queue.items.length > 0 ? "Close" : "Cancel"}
          </Button>
          {queue.items.length > 0 && !busy && (
            <Button variant="ghost" onClick={resetAll}>
              Clear
            </Button>
          )}
          <Button type="submit" form={`${target.area}-upload-form`} disabled={busy || queue.items.length === 0}>
            {busy ? (
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : error ? (
              <RotateCcw data-icon="inline-start" aria-hidden />
            ) : null}
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
