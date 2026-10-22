"use client";

import { ImageOff, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { compressImage, extensionOf, safeFileName, uploadFile } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import {
  BRANDING_FOLDER,
  BRANDING_IMAGE_ACCEPT,
  displayedImage,
  validateBrandingImage,
  type ImageChange,
} from "./settings-schema";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

/**
 * One branding image (logo, watermark, cover): drag-and-drop or pick, uploads
 * straight away to the staff-only `quotations` bucket and previews it. The
 * settings row only changes when the form is saved.
 */
export function BrandingImageField({
  slot,
  label,
  hint,
  wide = false,
  compress = false,
  currentUrl,
  change,
  onChange,
  onUploadingChange,
  disabled,
}: {
  /** Used in the storage path, e.g. "logo". */
  slot: string;
  label: string;
  hint: string;
  /** Landscape preview (cover image) instead of a square one. */
  wide?: boolean;
  /** Downscale big photos (cover). Logos keep their exact pixels and transparency. */
  compress?: boolean;
  /** The saved (signed) URL, "" when none. */
  currentUrl: string;
  change: ImageChange;
  onChange: (change: ImageChange) => void;
  onUploadingChange: (uploading: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);

  const shown = displayedImage(change, currentUrl);
  const uploading = progress !== null;
  const changed = change.kind !== "keep";

  // Local previews made here; revoked when the field goes away.
  const previewsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewsRef.current = [];
    },
    [],
  );

  const upload = async (file: File | undefined) => {
    if (!file || disabled || uploading) return;
    const ext = extensionOf(file.name);
    const problem = validateBrandingImage(file, ext);
    setError(problem);
    if (problem) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    onUploadingChange(true);
    try {
      const prepared = compress ? await compressImage(file, { maxDimension: 2400, quality: 0.85 }) : file;
      const path = `${BRANDING_FOLDER}/${slot}-${randomId()}-${safeFileName(prepared.name)}`;
      const ref = await uploadFile({
        bucket: "quotations",
        path,
        file: prepared,
        onProgress: setProgress,
        signal: controller.signal,
      });
      const previewUrl = URL.createObjectURL(prepared);
      previewsRef.current.push(previewUrl);
      onChange({ kind: "replace", ref, previewUrl });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error && e.message ? e.message : "Upload failed. Please try again.");
    } finally {
      abortRef.current = null;
      setProgress(null);
      onUploadingChange(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void upload(e.dataTransfer.files?.[0]);
  };

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium text-ink">
          {label}
        </p>
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={BRANDING_IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled || uploading}
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-lg ring-1 transition-colors",
          wide ? "aspect-[16/9]" : "aspect-square max-w-48",
          dragging ? "bg-ink/5 ring-2 ring-ink" : "ring-foreground/10",
          // Checkerboard so transparent logos are visible.
          !wide && shown && "bg-[conic-gradient(#f1f2f6_25%,#fff_0_50%,#f1f2f6_0_75%,#fff_0)] bg-[length:16px_16px]",
          !shown && "border border-dashed border-input bg-muted/40 ring-0",
        )}
      >
        {shown && broken !== shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL or local object URL
          <img
            src={shown}
            alt={`${label} preview`}
            className={cn("size-full", wide ? "object-cover" : "object-contain p-3")}
            onError={() => setBroken(shown)}
          />
        ) : shown ? (
          <span className="flex flex-col items-center gap-1 p-3 text-center text-xs text-muted-foreground">
            <ImageOff className="size-5" aria-hidden />
            Preview unavailable
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1.5 p-3 text-center text-xs text-muted-foreground">
            <Upload className="size-5" aria-hidden />
            Drop an image here
          </span>
        )}

        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-background/80">
            <div className="flex w-3/4 flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-ink" aria-hidden />
              <div
                role="progressbar"
                aria-label={`Uploading ${label.toLowerCase()}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress ?? 0) * 100)}
                className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
              >
                <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          aria-describedby={error ? errorId : hintId}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden />
          {shown ? "Replace" : "Upload"}
          <span className="sr-only"> {label.toLowerCase()}</span>
        </Button>
        {shown && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => onChange({ kind: "remove" })}
          >
            <Trash2 aria-hidden />
            Remove
            <span className="sr-only"> {label.toLowerCase()}</span>
          </Button>
        )}
        {changed && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => onChange({ kind: "keep" })}>
            <RotateCcw aria-hidden />
            Undo
          </Button>
        )}
        {changed && <span className="text-xs text-muted-foreground">Not saved yet</span>}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
