"use client";

import {
  CircleCheck,
  Clock,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Link2,
  MessageSquareDiff,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayFileName, downloadUrl, mediaKindOfUrl } from "../media/media";
import type { ApprovalDesign } from "./design-api";
import type { DecisionMode } from "./design-decision-dialog";
import {
  APPROVAL_STATE_LABELS,
  approvalStateOf,
  approvalSummary,
  clientCanDecide,
  designTitle,
  designTypeLabel,
} from "./design-utils";

export function ApprovalBadge({ design }: { design: ApprovalDesign }) {
  const state = approvalStateOf(design);
  if (state === "approved") {
    return (
      <Badge variant="secondary" className="bg-success/10 text-success">
        <CircleCheck data-icon="inline-start" aria-hidden />
        {APPROVAL_STATE_LABELS.approved}
      </Badge>
    );
  }
  if (state === "changes-requested") {
    return (
      <Badge variant="secondary" className="bg-warning/10 text-warning">
        <MessageSquareDiff data-icon="inline-start" aria-hidden />
        {APPROVAL_STATE_LABELS["changes-requested"]}
      </Badge>
    );
  }
  if (state === "pending") {
    return (
      <Badge variant="outline">
        <Clock data-icon="inline-start" aria-hidden />
        {APPROVAL_STATE_LABELS.pending}
      </Badge>
    );
  }
  return null;
}

const LONG_COMMENT = 120;

/** Who decided, when, and the client's note (above the card's click overlay). */
function ApprovalDetails({ design, viewer }: { design: ApprovalDesign; viewer: "staff" | "client" }) {
  const [expanded, setExpanded] = useState(false);
  const state = approvalStateOf(design);
  const summary = approvalSummary(design, viewer);
  const comment = state === "approved" || state === "changes-requested" ? design.approvalComment : null;
  if (!summary && !comment) return null;
  const long = (comment?.length ?? 0) > LONG_COMMENT;

  return (
    <div className="relative z-10 flex flex-col gap-1">
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
      {comment && (
        <div
          className={cn(
            "rounded-md px-2 py-1.5 text-xs break-words whitespace-pre-line text-ink",
            state === "changes-requested" ? "bg-warning/10" : "bg-muted/70",
          )}
        >
          <p className={cn(!expanded && "line-clamp-3")}>
            <span className="sr-only">{viewer === "client" ? "Your note: " : "Client's note: "}</span>
            {comment}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-0.5 font-medium text-ink underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              {expanded ? "Show less" : "Read all"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** One design tile: preview, title, type/approval, and an actions menu. */
export function DesignCard({
  design,
  viewer,
  onOpen,
  onCopyLink,
  canEdit,
  canDelete,
  onToggleApproval,
  onRequestReview,
  onDecide,
  onDelete,
}: {
  design: ApprovalDesign;
  viewer: "staff" | "client";
  onOpen: () => void;
  onCopyLink: () => void;
  canEdit: boolean;
  canDelete: boolean;
  onToggleApproval?: () => void;
  /** Staff: ask the client to review again after a decision. */
  onRequestReview?: () => void;
  /** Client: approve or ask for changes. */
  onDecide?: (mode: DecisionMode) => void;
  onDelete?: () => void;
}) {
  const title = designTitle(design);
  const kind = design.fileUrl ? mediaKindOfUrl(design.fileUrl) : "document";
  const state = approvalStateOf(design);
  const decidable = viewer === "client" && onDecide !== undefined && clientCanDecide(design);
  const canReRequest =
    canEdit && onRequestReview !== undefined && design.approvalRequired && (state === "changes-requested" || state === "approved");

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        state === "changes-requested" && viewer === "staff" && "ring-warning/40",
      )}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {kind === "image" && design.fileUrl ? (
          <Image
            src={design.fileUrl}
            alt=""
            fill
            unoptimized
            loading="lazy"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <span className="flex flex-col items-center gap-1">
              <FileText className="size-8" aria-hidden />
              <span className="text-xs font-semibold tracking-wide">{kind === "pdf" ? "PDF" : "FILE"}</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <h4 className="line-clamp-2 text-sm font-medium break-words text-ink">
          {/* The whole card is clickable; the link text is the accessible name. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {title}
          </button>
        </h4>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline">{designTypeLabel(design.type)}</Badge>
          <ApprovalBadge design={design} />
        </div>
        <ApprovalDetails design={design} viewer={viewer} />
        <p className="mt-auto truncate pt-0.5 text-xs text-muted-foreground">
          {formatDate(design.createdAt)}
          {design.roomName ? ` · ${design.roomName}` : ""}
        </p>
      </div>

      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="icon-sm"
                className="bg-background/90 shadow-sm backdrop-blur"
                aria-label={`Actions for ${title}`}
              />
            }
          >
            <Ellipsis aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {decidable && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onDecide?.("approved")}>
                    <CircleCheck aria-hidden />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDecide?.("changes_requested")}>
                    <MessageSquareDiff aria-hidden />
                    {state === "changes-requested" ? "Edit change request" : "Request changes"}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onCopyLink}>
                <Link2 aria-hidden />
                Copy link
              </DropdownMenuItem>
              {design.fileUrl && (
                <>
                  <DropdownMenuItem
                    render={<a href={design.fileUrl} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ExternalLink aria-hidden />
                    Open in new tab
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<a href={downloadUrl(design.fileUrl, displayFileName(design.fileUrl))} />}>
                    <Download aria-hidden />
                    Download
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuGroup>
            {(canEdit || canDelete) && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {canReRequest && (
                <DropdownMenuItem onClick={onRequestReview}>
                  <RotateCcw aria-hidden />
                  Ask client to review again
                </DropdownMenuItem>
              )}
              {canEdit && onToggleApproval && (
                <DropdownMenuItem onClick={onToggleApproval}>
                  <ShieldCheck aria-hidden />
                  {design.approvalRequired ? "Don't require approval" : "Ask client to approve"}
                </DropdownMenuItem>
              )}
              {canDelete && onDelete && (
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 aria-hidden />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
