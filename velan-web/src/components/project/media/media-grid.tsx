"use client";

import { FileText } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { displayFileName, mediaKindOfUrl } from "./media";
import { MediaViewer, type ViewerItem } from "./media-viewer";

const MAX_TILES = 4;

/**
 * Media attached to an update: a photo grid that opens the lightbox,
 * an inline native video player, and links for anything else.
 */
export function MediaGrid({
  urls,
  typeHint,
  altBase,
}: {
  urls: string[];
  /** The update's `type` ("photo" / "video"), for URLs without an extension. */
  typeHint?: string | null;
  /** Used for alt text: "<altBase>, photo 2 of 5". */
  altBase: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (urls.length === 0) return null;

  const classified = urls.map((url, i) => ({ url, i, kind: mediaKindOfUrl(url, typeHint) }));
  const photos = classified.filter((m) => m.kind === "image");
  const videos = classified.filter((m) => m.kind === "video");
  const others = classified.filter((m) => m.kind === "pdf" || m.kind === "document");

  const viewerItems: ViewerItem[] = photos.map((p, n) => ({
    key: `${p.i}`,
    url: p.url,
    kind: "image",
    title: `${altBase}, photo ${n + 1} of ${photos.length}`,
    downloadName: displayFileName(p.url),
  }));

  const shown = photos.slice(0, MAX_TILES);
  const extra = photos.length - shown.length;

  return (
    <div className="flex flex-col gap-2">
      {photos.length > 0 && (
        <ul
          aria-label={`${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
          className={cn(
            "grid gap-1.5 overflow-hidden rounded-lg",
            shown.length === 1 ? "grid-cols-1" : "grid-cols-2",
            shown.length === 3 && "grid-rows-2",
          )}
        >
          {shown.map((p, n) => (
            <li
              key={p.i}
              className={cn(
                "relative",
                shown.length === 1 ? "aspect-[4/3] max-h-[28rem]" : "aspect-square",
                shown.length === 3 && n === 0 && "row-span-2 aspect-auto",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(n)}
                className="group absolute inset-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={
                  n === MAX_TILES - 1 && extra > 0
                    ? `Open photo ${n + 1} of ${photos.length} (${extra} more)`
                    : `Open photo ${n + 1} of ${photos.length}`
                }
              >
                <Image
                  src={p.url}
                  alt={viewerItems[n].title}
                  fill
                  unoptimized
                  loading="lazy"
                  sizes="(min-width: 768px) 360px, 50vw"
                  className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
                {n === MAX_TILES - 1 && extra > 0 && (
                  <span
                    aria-hidden
                    className="absolute inset-0 grid place-items-center bg-black/55 font-heading text-2xl font-semibold text-white"
                  >
                    +{extra}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {videos.map((v) => (
        <video
          key={v.i}
          src={v.url}
          controls
          playsInline
          preload="metadata"
          aria-label={`${altBase}, video`}
          className="aspect-video w-full rounded-lg bg-black"
        />
      ))}

      {others.length > 0 && (
        <ul className="flex flex-col gap-1">
          {others.map((o) => (
            <li key={o.i}>
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-ink underline-offset-4 hover:bg-muted hover:underline"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{displayFileName(o.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <MediaViewer items={viewerItems} index={open} onIndexChange={setOpen} label="Update photos" />
    </div>
  );
}
