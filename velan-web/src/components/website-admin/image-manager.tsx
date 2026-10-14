"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, RotateCcw, Star, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MAX_PORTFOLIO_IMAGES } from "@/lib/api/portfolio-admin";
import { cn } from "@/lib/utils";
import { PortfolioImage } from "./portfolio-image";
import { ACCEPT_IMAGES, moveInArray, moveToTarget, type PendingUpload, type RejectedUpload } from "./portfolio-rules";
import type { useImageUploads } from "./use-image-uploads";

type Uploads = ReturnType<typeof useImageUploads>;

const TILE_SIZES = "(min-width: 1280px) 220px, (min-width: 640px) 30vw, 45vw";

/** Files from a drop or a file input, as a plain array. */
function filesOf(list: FileList | null): File[] {
  return list ? Array.from(list) : [];
}

/**
 * Cover photo + gallery for one portfolio item. Upload state lives in the
 * editor (`useImageUploads`) so it can block saving and warn before leaving.
 */
export function ImageManager({
  coverImageUrl,
  imageUrls,
  onCoverChange,
  onImagesChange,
  gallery,
  cover,
  error,
}: {
  coverImageUrl: string | null;
  imageUrls: string[];
  onCoverChange: (url: string | null) => void;
  onImagesChange: (urls: string[]) => void;
  gallery: Uploads;
  cover: Uploads;
  error?: string;
}) {
  const [rejected, setRejected] = useState<RejectedUpload[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const count = imageUrls.length;

  const addGallery = (files: File[]) => {
    if (files.length === 0) return;
    setRejected(gallery.add(files));
  };
  const addCover = (files: File[]) => {
    if (files.length === 0) return;
    setRejected(cover.add(files.slice(0, 1)));
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = moveInArray(imageUrls, index, delta);
    onImagesChange(next);
    setAnnouncement(`Photo moved to position ${index + delta + 1} of ${next.length}.`);
  };

  const remove = (url: string, index: number) => {
    onImagesChange(imageUrls.filter((u) => u !== url));
    if (coverImageUrl === url) onCoverChange(null);
    setAnnouncement(`Photo ${index + 1} removed.`);
  };

  return (
    <div className="flex flex-col gap-6">
      {rejected.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>
            {rejected.length === 1 ? "1 file wasn't added" : `${rejected.length} files weren't added`}
          </AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-0.5">
              {rejected.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  <span className="font-medium">{r.name}</span> — {r.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setRejected([])}>
              <X aria-hidden />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Cover */}
      <section aria-labelledby="cover-heading" className="flex flex-col gap-3">
        <div>
          <h3 id="cover-heading" className="text-sm font-medium text-ink">
            Cover photo
          </h3>
          <p className="text-xs text-muted-foreground">
            Shown on the portfolio grid and at the top of the project page. Pick one from the gallery or upload one.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 sm:w-56">
            {coverImageUrl ? (
              <PortfolioImage src={coverImageUrl} alt="Cover photo" sizes="224px" />
            ) : (
              <span className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
                {imageUrls.length > 0 ? "No cover chosen — the first gallery photo is used." : "No cover photo yet."}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <FilePicker label={coverImageUrl ? "Upload a different cover" : "Upload a cover"} onFiles={addCover} />
            {coverImageUrl && (
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onCoverChange(null)}>
                <Trash2 data-icon="inline-start" aria-hidden />
                Remove cover
              </Button>
            )}
            <PendingList uploads={cover} />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section aria-labelledby="gallery-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="gallery-heading" className="text-sm font-medium text-ink">
            Gallery
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {count} of {MAX_PORTFOLIO_IMAGES} photos
          </span>
        </div>

        <Dropzone onFiles={addGallery} disabled={count >= MAX_PORTFOLIO_IMAGES} />
        <PendingList uploads={gallery} />

        {imageUrls.length > 0 && (
          <GalleryGrid
            imageUrls={imageUrls}
            coverImageUrl={coverImageUrl}
            onMove={move}
            onReorder={(next) => onImagesChange(next)}
            onRemove={remove}
            onMakeCover={(url, index) => {
              onCoverChange(url);
              setAnnouncement(`Photo ${index + 1} is now the cover.`);
            }}
          />
        )}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </section>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function FilePicker({ label, onFiles }: { label: string; onFiles: (files: File[]) => void }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="inline-flex h-7 w-fit cursor-pointer items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50"
    >
      <Upload className="size-3.5" aria-hidden />
      {label}
      <input
        id={id}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onFiles(filesOf(e.target.files));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Dropzone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled: boolean }) {
  const id = useId();
  const [over, setOver] = useState(false);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        onFiles(filesOf(e.dataTransfer.files));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-input px-4 py-6 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50",
        over && "border-gold bg-gold/10",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
      <span className="text-sm font-medium text-ink">
        {disabled ? "The gallery is full" : "Drag photos here, or click to choose"}
      </span>
      <span className="text-xs text-muted-foreground">
        JPEG, PNG, WebP or AVIF · up to 10 MB each (larger JPEG/PNG/WebP photos are resized) · {MAX_PORTFOLIO_IMAGES} max
      </span>
      <input
        id={id}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles(filesOf(e.target.files));
          e.target.value = "";
        }}
      />
    </label>
  );
}

const STATUS_TEXT: Record<PendingUpload["status"], string> = {
  queued: "Waiting…",
  uploading: "Uploading…",
  done: "Uploaded",
  error: "Failed",
};

function PendingList({ uploads }: { uploads: Uploads }) {
  if (uploads.pending.length === 0) return null;
  return (
    <ul aria-label="Uploads" className="flex flex-col gap-2">
      {uploads.pending.map((p) => (
        <li key={p.key} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            <PortfolioImage src={p.previewUrl} sizes="40px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{p.name}</p>
            {p.status === "error" ? (
              <p className="text-xs text-destructive" role="alert">
                {p.error}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <ProgressBar value={p.progress * 100} label={`Uploading ${p.name}`} className="flex-1" />
                <span className="sr-only">{STATUS_TEXT[p.status]}</span>
              </div>
            )}
          </div>
          {p.status === "error" ? (
            <>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retry ${p.name}`} onClick={() => uploads.retry(p.key)}>
                <RotateCcw aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} onClick={() => uploads.dismiss(p.key)}>
                <X aria-hidden />
              </Button>
            </>
          ) : (
            <>
              {p.status === "queued" && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Cancel ${p.name}`} onClick={() => uploads.dismiss(p.key)}>
                <X aria-hidden />
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function GalleryGrid({
  imageUrls,
  coverImageUrl,
  onMove,
  onReorder,
  onRemove,
  onMakeCover,
}: {
  imageUrls: string[];
  coverImageUrl: string | null;
  onMove: (index: number, delta: -1 | 1) => void;
  onReorder: (next: string[]) => void;
  onRemove: (url: string, index: number) => void;
  onMakeCover: (url: string, index: number) => void;
}) {
  const [dragUrl, setDragUrl] = useState<string | null>(null);
  const [overUrl, setOverUrl] = useState<string | null>(null);
  const reset = () => {
    setDragUrl(null);
    setOverUrl(null);
  };

  return (
    <ol aria-label="Gallery photos in display order" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {imageUrls.map((url, index) => {
        const isCover = url === coverImageUrl;
        const n = index + 1;
        return (
          <li
            key={url}
            draggable
            onDragStart={(e) => {
              setDragUrl(url);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", url);
            }}
            onDragOver={(e) => {
              if (!dragUrl) return;
              e.preventDefault();
              if (overUrl !== url) setOverUrl(url);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragUrl && dragUrl !== url) onReorder(moveToTarget(imageUrls, dragUrl, url));
              reset();
            }}
            onDragEnd={reset}
            className={cn(
              "flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10",
              dragUrl === url && "opacity-50",
              overUrl === url && dragUrl !== url && "ring-2 ring-gold",
            )}
          >
            <div className="relative aspect-[4/3] cursor-grab bg-muted active:cursor-grabbing">
              <PortfolioImage src={url} alt={`Photo ${n}`} sizes={TILE_SIZES} />
              <span className="absolute top-1.5 left-1.5 rounded-md bg-ink/80 px-1.5 text-xs tabular-nums text-white">{n}</span>
              {isCover && (
                <Badge className="absolute top-1.5 right-1.5 bg-gold text-ink">
                  <Star data-icon="inline-start" aria-hidden />
                  Cover
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-0.5 p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                focusableWhenDisabled
                aria-label={`Move photo ${n} earlier`}
                onClick={() => onMove(index, -1)}
              >
                <ArrowLeft aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === imageUrls.length - 1}
                focusableWhenDisabled
                aria-label={`Move photo ${n} later`}
                onClick={() => onMove(index, 1)}
              >
                <ArrowRight aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isCover}
                focusableWhenDisabled
                aria-label={isCover ? `Photo ${n} is the cover` : `Use photo ${n} as the cover`}
                title={isCover ? "Cover photo" : "Use as cover"}
                onClick={() => onMakeCover(url, index)}
              >
                <Star aria-hidden className={cn(isCover && "fill-gold text-ink")} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove photo ${n}`}
                title="Remove"
                onClick={() => onRemove(url, index)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
