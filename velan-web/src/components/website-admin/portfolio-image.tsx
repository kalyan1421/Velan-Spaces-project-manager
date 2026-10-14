"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Blob previews and local Supabase can't go through the image optimizer. */
function bypassOptimizer(src: string): boolean {
  if (src.startsWith("blob:") || src.startsWith("data:")) return true;
  try {
    const { hostname } = new URL(src);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
  } catch {
    return true;
  }
}

/**
 * Fills its (relatively positioned, sized) parent. Shows a neutral placeholder
 * when there is no image or it fails to load.
 */
export function PortfolioImage({
  src,
  alt = "",
  sizes,
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  sizes: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) {
    return (
      <span className={cn("absolute inset-0 grid place-items-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-5" aria-hidden />
        {alt && <span className="sr-only">{alt}</span>}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={bypassOptimizer(src)}
      draggable={false}
      onError={() => setFailed(src)}
      className={cn("object-cover", className)}
    />
  );
}
