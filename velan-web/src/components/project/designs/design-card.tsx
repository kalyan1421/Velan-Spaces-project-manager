"use client";

import {
  CircleCheck,
  Clock,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Link2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Image from "next/image";
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
import type { Design } from "@/lib/api/project-content";
import { formatDate } from "@/lib/format";
import { displayFileName, downloadUrl, mediaKindOfUrl } from "../media/media";
import { approvalStateOf, designTitle, designTypeLabel } from "./design-utils";

export function ApprovalBadge({ design }: { design: Design }) {
  const state = approvalStateOf(design);
  if (state === "approved") {
    return (
      <Badge variant="secondary">
        <CircleCheck data-icon="inline-start" aria-hidden />
        Approved
      </Badge>
    );
  }
  if (state === "pending") {
    return (
      <Badge variant="outline">
        <Clock data-icon="inline-start" aria-hidden />
        Awaiting approval
      </Badge>
    );
  }
  return null;
}

/** One design tile: preview, title, type/approval, and an actions menu. */
export function DesignCard({
  design,
  onOpen,
  onCopyLink,
  canEdit,
  canDelete,
  onToggleApproval,
  onDelete,
}: {
  design: Design;
  onOpen: () => void;
  onCopyLink: () => void;
  canEdit: boolean;
  canDelete: boolean;
  onToggleApproval?: () => void;
  onDelete?: () => void;
}) {
  const title = designTitle(design);
  const kind = design.fileUrl ? mediaKindOfUrl(design.fileUrl) : "document";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
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
        <p className="mt-auto truncate text-xs text-muted-foreground">
          {formatDate(design.createdAt)}
          {design.roomName ? ` · ${design.roomName}` : ""}
        </p>
      </div>

      <div className="absolute top-2 right-2">
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
          <DropdownMenuContent align="end" className="w-52">
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
