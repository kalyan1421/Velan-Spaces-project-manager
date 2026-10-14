"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from "lucide-react";
import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadUrl, type MediaKind } from "./media";

export type ViewerItem = {
  key: string;
  /** Signed URL; null when the file is missing. */
  url: string | null;
  kind: MediaKind;
  /** Shown in the header and used as alt text. */
  title: string;
  description?: string;
  downloadName?: string;
};

const ICON_BUTTON = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/60",
);

function Stage({ item }: { item: ViewerItem }) {
  if (!item.url) {
    return <p className="m-auto px-6 text-center text-sm text-white/80">This file is no longer available.</p>;
  }
  if (item.kind === "image") {
    return (
      <div className="relative size-full">
        <Image src={item.url} alt={item.title} fill unoptimized sizes="100vw" className="object-contain" />
      </div>
    );
  }
  if (item.kind === "video") {
    return (
      <video
        src={item.url}
        controls
        playsInline
        preload="metadata"
        aria-label={item.title}
        className="m-auto max-h-full max-w-full bg-black"
      />
    );
  }
  if (item.kind === "pdf") {
    // The browser's PDF viewer streams large files (range requests) from the signed URL.
    return <iframe src={item.url} title={item.title} className="size-full rounded-md bg-white" />;
  }
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white/90">
      <FileText className="size-10" aria-hidden />
      <p className="text-sm">This file can&apos;t be previewed here. Open or download it instead.</p>
    </div>
  );
}

/**
 * Full-screen viewer for photos, videos and PDFs. Modal with focus trap
 * (Base UI); ←/→ move between items, Esc closes, focus returns to the opener.
 */
export function MediaViewer({
  items,
  index,
  onIndexChange,
  label,
  renderActions,
}: {
  items: ViewerItem[];
  /** Open item, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** What is being viewed, e.g. "Update photos". */
  label: string;
  renderActions?: (item: ViewerItem) => ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = index !== null && index >= 0 && index < items.length;
  const current = open ? items[index] : null;
  const count = items.length;

  const go = (delta: number) => {
    if (!open || count < 2) return;
    onIndexChange((index + delta + count) % count);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/90 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          initialFocus={closeRef}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("video, input, textarea, select")) return;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              go(1);
            }
          }}
        >
          {current && (
            <>
              <header className="flex items-center gap-1 px-2 py-2 sm:gap-2 sm:px-4">
                <div className="min-w-0 flex-1 px-1">
                  <DialogPrimitive.Title className="truncate text-sm font-medium">{current.title}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="truncate text-xs text-white/70">
                    {count > 1 ? `${(index ?? 0) + 1} of ${count}` : label}
                    {current.description ? ` · ${current.description}` : ""}
                  </DialogPrimitive.Description>
                </div>
                {renderActions?.(current)}
                {current.url && (
                  <>
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ICON_BUTTON}
                      aria-label="Open in a new tab"
                      title="Open in a new tab"
                    >
                      <ExternalLink aria-hidden />
                    </a>
                    <a
                      href={downloadUrl(current.url, current.downloadName ?? current.title)}
                      className={ICON_BUTTON}
                      aria-label="Download"
                      title="Download"
                      download
                    >
                      <Download aria-hidden />
                    </a>
                  </>
                )}
                <DialogPrimitive.Close ref={closeRef} className={ICON_BUTTON} aria-label="Close viewer">
                  <X aria-hidden />
                </DialogPrimitive.Close>
              </header>

              <div className="relative flex min-h-0 flex-1 px-2 pb-2 sm:px-16 sm:pb-6" key={current.key}>
                <Stage item={current} />
              </div>

              {count > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => go(-1)}
                    aria-label="Previous"
                    className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:left-3"
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => go(1)}
                    aria-label="Next"
                    className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:right-3"
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </>
              )}
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
