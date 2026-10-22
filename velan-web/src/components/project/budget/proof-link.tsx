"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { proofKind } from "./proof";

/**
 * Proof thumbnail that opens the signed URL in a new tab. Signed URLs expire
 * (~50 min) and carry a token, so they are never cached or sent as a referrer.
 */
export function ProofLink({ url, label, className }: { url: string | null; label: string; className?: string }) {
  const [broken, setBroken] = useState(false);

  if (!url) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">No proof</span>
      </span>
    );
  }

  const kind = proofKind(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      title="Open proof"
      className={cn(
        "inline-flex size-9 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10 outline-none transition-shadow hover:ring-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {kind === "image" && !broken ? (
        // Short-lived signed URL: next/image would cache a URL that stops working.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <FileText className="size-4 text-muted-foreground" aria-hidden />
      )}
      <span className="sr-only">
        Open {kind === "pdf" ? "PDF " : ""}proof for {label} (opens in a new tab)
      </span>
    </a>
  );
}
