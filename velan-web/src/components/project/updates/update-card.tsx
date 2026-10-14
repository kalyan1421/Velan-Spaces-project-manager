"use client";

import { DoorOpen, EyeOff, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { initialsOf } from "@/components/app-shell/user-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ContentPerson, ProjectUpdate, Room } from "@/lib/api/project-content";
import { roleLabel } from "@/lib/auth/roles";
import { formatDateTime, formatRelative } from "@/lib/format";
import { MediaGrid } from "../media/media-grid";
import { UpdateComments } from "./update-comments";
import { taggedPeople } from "./update-meta";

export function RelativeTime({ value }: { value: string }) {
  const exact = formatDateTime(value);
  return (
    <Tooltip>
      <TooltipTrigger
        render={<time dateTime={value} suppressHydrationWarning />}
        className="cursor-default underline-offset-4 hover:underline"
      >
        {formatRelative(value)}
        <span className="sr-only"> ({exact})</span>
      </TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}

export function UpdateCard({
  update,
  roomsById,
  directory,
  showStaffDetails,
  canDelete,
  canComment,
  deleting,
  onDelete,
  onAddComment,
}: {
  update: ProjectUpdate;
  roomsById: ReadonlyMap<string, Room>;
  directory: ReadonlyMap<string, ContentPerson>;
  /** Staff app: show visibility and tagged workers. */
  showStaffDetails: boolean;
  canDelete: boolean;
  canComment: boolean;
  deleting: boolean;
  onDelete: (update: ProjectUpdate) => Promise<boolean>;
  onAddComment: (update: ProjectUpdate, text: string) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const author = update.postedByName ?? "Team member";
  const room = update.roomId ? roomsById.get(update.roomId) : undefined;
  const tagged = taggedPeople(update.associatedWorkerIds, directory);
  const headingId = `update-${update.id}-author`;
  const excerpt = update.content.trim().slice(0, 80);
  const altBase = excerpt ? `${author}: ${excerpt}` : `Update from ${author}`;

  return (
    <article aria-labelledby={headingId} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white"
        >
          {initialsOf(author)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span id={headingId} className="truncate font-medium text-ink">
              {author}
            </span>
            {update.role && <span className="text-xs text-muted-foreground">{roleLabel(update.role)}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {update.createdAt ? <RelativeTime value={update.createdAt} /> : "—"}
          </p>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete update from ${author}`}
            disabled={deleting}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </header>

      {(update.category || room || (showStaffDetails && !update.isClientViewable)) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {update.category && <Badge variant="secondary">{update.category}</Badge>}
          {room && (
            <Badge variant="outline">
              <DoorOpen data-icon="inline-start" aria-hidden />
              {room.name}
            </Badge>
          )}
          {showStaffDetails && !update.isClientViewable && (
            <Badge variant="outline">
              <EyeOff data-icon="inline-start" aria-hidden />
              Staff only
            </Badge>
          )}
        </div>
      )}

      {update.content.trim() && (
        <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">{update.content}</p>
      )}

      {update.mediaUrls.length > 0 && (
        <div className="mt-3">
          <MediaGrid urls={update.mediaUrls} typeHint={update.type} altBase={altBase} />
        </div>
      )}

      {showStaffDetails && update.associatedWorkerIds.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" aria-hidden />
          <span className="sr-only">Tagged workers:</span>
          {tagged.people.map((p) => (
            <Badge key={p.id} variant="outline">
              {p.name}
            </Badge>
          ))}
          {tagged.unknown > 0 && (
            <span>
              {tagged.people.length > 0
                ? `+${tagged.unknown} more`
                : `${tagged.unknown} ${tagged.unknown === 1 ? "worker" : "workers"} tagged`}
            </span>
          )}
        </p>
      )}

      <UpdateComments update={update} canComment={canComment} onAddComment={onAddComment} />

      {canDelete && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this update?</AlertDialogTitle>
              <AlertDialogDescription>
                The post by {author}
                {update.mediaUrls.length > 0
                  ? ` and its ${update.mediaUrls.length} ${update.mediaUrls.length === 1 ? "attachment" : "attachments"}`
                  : ""}{" "}
                will be removed for everyone, including the client. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  if (await onDelete(update)) setConfirming(false);
                }}
              >
                {deleting ? "Deleting…" : "Delete update"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </article>
  );
}
