"use client";

import { CalendarDays, ChevronDown, DoorOpen, ListChecks, MessageSquare, UserRound } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/project/form/native-select";
import { TASK_STATUSES, type TimelineTask } from "@/lib/api/project-ops";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PriorityBadge, TaskStatusBadge } from "./status-badges";
import {
  TASK_STATUS_LABEL,
  canProgressTask,
  checklistToggled,
  normalizePriority,
  normalizeTaskStatus,
  type Viewer,
} from "./timeline-model";
import { useTaskProgress } from "./use-task-progress";

export type TaskItemProps = {
  task: TimelineTask;
  projectId: string;
  viewer: Viewer;
  roomName: string | null;
  /** undefined hides the assignee entirely (client portal). */
  assigneeName?: string | null;
};

function dateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `From ${formatDate(start)}` : `By ${formatDate(end)}`;
}

export function TaskItem({ task, projectId, viewer, roomName, assigneeName }: TaskItemProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const progress = useTaskProgress(projectId);
  const status = normalizeTaskStatus(task.status);
  const checklist = task.checklistItems ?? [];
  const comments = task.comments ?? [];
  const photos = task.photoProofUrls ?? [];
  const doneItems = checklist.filter((i) => i.isDone).length;
  const editable = canProgressTask(viewer, task);
  const mine = viewer.role === "worker" && task.assignedWorkerId === viewer.id;
  const planned = dateRange(task.plannedStart, task.plannedEnd);

  return (
    <li className={cn("rounded-lg border bg-card", mine && "border-gold/60")}>
      <div className="flex items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((o) => !o)}
            className="group flex w-full items-start gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className={cn("min-w-0 flex-1 font-medium text-ink", status === "done" && "text-muted-foreground line-through")}>
              {task.title}
            </span>
            <ChevronDown
              aria-hidden
              className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            />
            <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <TaskStatusBadge status={status} />
            <PriorityBadge priority={normalizePriority(task.priority)} />
            {roomName && (
              <span className="inline-flex items-center gap-1">
                <DoorOpen className="size-3.5" aria-hidden />
                {roomName}
              </span>
            )}
            {assigneeName !== undefined && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" aria-hidden />
                {mine ? "You" : (assigneeName ?? "Unassigned")}
              </span>
            )}
            {planned && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden />
                {planned}
              </span>
            )}
            {checklist.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3.5" aria-hidden />
                {doneItems}/{checklist.length}
                <span className="sr-only"> checklist items done</span>
              </span>
            )}
            {comments.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" aria-hidden />
                {comments.length}
                <span className="sr-only"> comments</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div id={detailsId} hidden={!open} className="flex flex-col gap-4 border-t px-3 py-3 text-sm">
        {task.description && <p className="whitespace-pre-line text-ink">{task.description}</p>}
        {task.actualEnd && status === "done" && (
          <p className="text-xs text-muted-foreground">Completed {formatDate(task.actualEnd)}</p>
        )}

        {editable && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${detailsId}-status`} className="text-xs font-medium text-ink">
              Status
            </label>
            <NativeSelect
              id={`${detailsId}-status`}
              wrapperClassName="w-full sm:w-48"
              value={status}
              disabled={progress.isPending}
              onChange={(e) => progress.mutate({ taskId: task.id, body: { status: e.target.value as typeof status } })}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
            {checklist.length > 0 && (
              <p className="text-xs text-muted-foreground">Ticking every checklist item marks the task done.</p>
            )}
          </div>
        )}

        {checklist.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-ink">Checklist</legend>
            {checklist.map((item) => (
              <label key={item.id} className="flex items-start gap-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={item.isDone}
                  disabled={!editable || progress.isPending}
                  onCheckedChange={(checked) =>
                    progress.mutate({ taskId: task.id, body: { checklistItems: checklistToggled(checklist, item.id, checked) } })
                  }
                />
                <span className={cn("text-ink", item.isDone && "text-muted-foreground line-through")}>{item.label}</span>
              </label>
            ))}
          </fieldset>
        )}

        {photos.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-ink">Photo proof</p>
            <ul className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <li key={url.split("?")[0]}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-md ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Image src={url} alt={`Photo proof ${i + 1} for ${task.title}`} width={72} height={72} unoptimized className="size-18 object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {comments.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-ink">Comments</p>
            <ul className="flex flex-col gap-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-ink">{c.postedBy ?? "Team"}</span>
                    {c.createdAt ? ` · ${formatRelative(c.createdAt)}` : null}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-ink">{c.text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!task.description && checklist.length === 0 && photos.length === 0 && comments.length === 0 && !editable && (
          <p className="text-xs text-muted-foreground">No further details for this task.</p>
        )}
      </div>
    </li>
  );
}
