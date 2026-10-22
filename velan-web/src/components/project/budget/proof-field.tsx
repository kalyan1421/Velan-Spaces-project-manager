"use client";

import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { PROOF_BUCKET } from "@/lib/api/money";
import { buildProjectObjectPath, compressImage, extensionOf, uploadFile } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { PROOF_ACCEPT, proofKind, validateProofFile } from "./proof";
import { ProofLink } from "./proof-link";

/** The proof as the form holds it until save. */
export type ProofDraft = { file: File | null; removed: boolean };
export const EMPTY_PROOF_DRAFT: ProofDraft = { file: null, removed: false };

/** Compresses photos, signs a project-scoped path and PUTs the bytes. Resolves to the `sb://` ref. */
export async function uploadProof({
  projectId,
  area,
  file,
  onProgress,
  signal,
}: {
  projectId: string;
  area: string;
  file: File;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const prepared = await compressImage(file);
  const path = buildProjectObjectPath(projectId, area, prepared.name);
  return uploadFile({ bucket: PROOF_BUCKET, path, file: prepared, onProgress, signal });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Local preview of a chosen photo (object URL created and revoked in an effect). */
function LocalPreview({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const isImage = proofKind(file.name) === "image";

  useEffect(() => {
    if (!isImage || !imgRef.current) return;
    const url = URL.createObjectURL(file);
    imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
      {isImage && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img ref={imgRef} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <FileText className="size-5 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

/**
 * Proof picker: drag-and-drop or "Choose file", images or PDF (≤ 20 MB),
 * with a preview and upload progress. Uploading happens on save.
 */
export function ProofField({
  existingUrl,
  draft,
  onChange,
  progress,
  disabled,
  label = "Proof",
}: {
  existingUrl: string | null;
  draft: ProofDraft;
  onChange: (draft: ProofDraft) => void;
  /** 0..1 while uploading, else null. */
  progress: number | null;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateProofFile(file);
    setError(problem);
    if (!problem) onChange({ file, removed: draft.removed });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    pick(e.dataTransfer.files?.[0]);
  };

  const openPicker = () => inputRef.current?.click();
  const showExisting = !draft.file && !draft.removed && existingUrl;
  const describedBy = error ? errorId : hintId;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-ink">
        {label} <span className="font-normal text-muted-foreground">(optional)</span>
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={PROOF_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {draft.file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
          <LocalPreview file={draft.file} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{draft.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {extensionOf(draft.file.name).toUpperCase()} · {formatSize(draft.file.size)}
            </p>
            {progress !== null && (
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-label="Uploading proof"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
                >
                  <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(progress * 100)}%</span>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${draft.file.name}`}
            onClick={() => onChange({ file: null, removed: draft.removed })}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : showExisting ? (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
          <ProofLink url={existingUrl} label="this entry" className="size-12" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">Current proof attached.</p>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={openPicker}>
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ file: null, removed: true })}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
            dragging ? "border-ink bg-ink/5" : "border-input bg-muted/40",
          )}
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Drag a photo or PDF of the bill here, or</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={openPicker}
            aria-describedby={describedBy}
            aria-labelledby={`${id}-label ${id}-choose`}
          >
            <Paperclip data-icon="inline-start" aria-hidden />
            <span id={`${id}-choose`}>Choose file</span>
          </Button>
          {draft.removed && existingUrl && (
            <button
              type="button"
              className="text-xs font-medium text-ink underline underline-offset-4"
              onClick={() => onChange({ file: null, removed: false })}
            >
              Undo remove
            </button>
          )}
        </div>
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-xs text-muted-foreground">
          JPG, PNG, HEIC or PDF, up to 20 MB.
        </p>
      )}
    </div>
  );
}
