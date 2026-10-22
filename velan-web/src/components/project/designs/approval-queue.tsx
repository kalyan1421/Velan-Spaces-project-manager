"use client";

import { CircleCheck, FileText, MessageSquareDiff } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { mediaKindOfUrl } from "../media/media";
import type { ApprovalDesign } from "./design-api";
import type { DecisionMode } from "./design-decision-dialog";
import { designTitle, designTypeLabel } from "./design-utils";

/**
 * Client portal: designs the team asked the client to approve, each with
 * View / Request changes / Approve. Hidden when nothing is waiting.
 */
export function ApprovalQueue({
  projectId,
  designs,
  onView,
  onDecide,
}: {
  projectId: string;
  designs: ApprovalDesign[];
  onView: (design: ApprovalDesign) => void;
  onDecide: (design: ApprovalDesign, mode: DecisionMode) => void;
}) {
  if (designs.length === 0) return null;
  const headingId = `approval-queue-${projectId}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl bg-gold/10 p-4 ring-1 ring-gold/40 sm:p-5"
    >
      <div>
        <h2 id={headingId} className="font-heading text-lg font-semibold text-ink">
          Waiting for your approval
          <span className="ml-2 text-sm font-normal text-muted-foreground">{designs.length}</span>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Have a look, then approve or tell the team what you&apos;d like changed.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {designs.map((d) => {
          const title = designTitle(d);
          const isImage = d.fileUrl !== null && mediaKindOfUrl(d.fileUrl) === "image";
          return (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                onClick={() => onView(d)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {isImage && d.fileUrl ? (
                    <Image src={d.fileUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />
                  ) : (
                    <FileText className="size-6" aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[designTypeLabel(d.type), d.roomName, `Shared ${formatDate(d.createdAt)}`].filter(Boolean).join(" · ")}
                  </span>
                  <span className="sr-only">. Open to view</span>
                </span>
              </button>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Button
                  variant="outline"
                  onClick={() => onDecide(d, "changes_requested")}
                  aria-label={`Request changes to ${title}`}
                >
                  <MessageSquareDiff data-icon="inline-start" aria-hidden />
                  Request changes
                </Button>
                <Button onClick={() => onDecide(d, "approved")} aria-label={`Approve ${title}`}>
                  <CircleCheck data-icon="inline-start" aria-hidden />
                  Approve
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
