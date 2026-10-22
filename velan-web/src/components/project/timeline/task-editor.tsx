"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { NativeSelect } from "@/components/project/form/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITIES, TASK_STATUSES, TIMELINE_LIMITS } from "@/lib/api/project-ops";
import { cn } from "@/lib/utils";
import { ChecklistEditor } from "./checklist-editor";
import { FieldError, ReorderButtons, useEditor, useFieldA11y } from "./editor-context";
import { checklistFieldId, taskFieldId, type DraftTask, type TaskFields } from "./timeline-editor";
import { PRIORITY_LABEL, TASK_STATUS_LABEL, isoToDateKey } from "./timeline-model";

const labelClass = "text-xs font-medium text-ink";

export function TaskEditor({
  phaseKey,
  task,
  index,
  count,
}: {
  phaseKey: string;
  task: DraftTask;
  index: number;
  count: number;
}) {
  const { dispatch, workers, rooms, phaseOptions, disabled, announce, focusAfterRender, errors } = useEditor();
  const detailsId = useId();
  const title = useFieldA11y(taskFieldId(task.key, "title"));
  const assignee = useFieldA11y(taskFieldId(task.key, "assignee"));
  const room = useFieldA11y(taskFieldId(task.key, "room"));
  const end = useFieldA11y(taskFieldId(task.key, "end"));
  const description = useFieldA11y(taskFieldId(task.key, "description"));
  const hasHiddenError =
    Boolean(end.error || description.error) || task.checklistItems.some((i) => errors.has(checklistFieldId(task.key, i.id)));
  const [open, setOpen] = useState(false);
  const expanded = open || hasHiddenError;
  const label = task.title.trim() || `task ${index + 1}`;
  const update = (patch: TaskFields) =>
    dispatch({ type: "updateTask", phaseKey, taskKey: task.key, patch });
  const workerKnown = !task.assignedWorkerId || workers.some((w) => w.id === task.assignedWorkerId);
  const roomKnown = !task.roomId || rooms.some((r) => r.id === task.roomId);

  return (
    <li className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={title.props.id} className={labelClass}>
              Task {index + 1}
            </label>
            <Input
              {...title.props}
              value={task.title}
              placeholder="e.g. Install false ceiling"
              maxLength={TIMELINE_LIMITS.taskTitle}
              disabled={disabled}
              onChange={(e) => update({ title: e.target.value })}
            />
            <FieldError fieldId={title.props.id} message={title.error} />
          </div>
          <div className="flex items-center gap-0.5 pt-5">
            <ReorderButtons
              idBase={`task-${task.key}-move`}
              label={label}
              index={index}
              count={count}
              onMove={(offset) => {
                dispatch({ type: "moveTask", phaseKey, taskKey: task.key, offset });
                announce(`Moved ${label} to position ${index + offset + 1} of ${count}.`);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label}`}
              disabled={disabled}
              onClick={() => {
                dispatch({ type: "removeTask", phaseKey, taskKey: task.key });
                announce(`Removed ${label}.`);
                focusAfterRender(`phase-${phaseKey}-add-task`);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${detailsId}-status`} className={labelClass}>
              Status
            </label>
            <NativeSelect
              id={`${detailsId}-status`}
              value={task.status}
              disabled={disabled}
              onChange={(e) => update({ status: e.target.value as DraftTask["status"] })}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${detailsId}-priority`} className={labelClass}>
              Priority
            </label>
            <NativeSelect
              id={`${detailsId}-priority`}
              value={task.priority}
              disabled={disabled}
              onChange={(e) => update({ priority: e.target.value as DraftTask["priority"] })}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={assignee.props.id} className={labelClass}>
              Assignee
            </label>
            <NativeSelect
              {...assignee.props}
              value={task.assignedWorkerId}
              disabled={disabled}
              onChange={(e) => update({ assignedWorkerId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {!workerKnown && <option value={task.assignedWorkerId}>Not on this project</option>}
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError fieldId={assignee.props.id} message={assignee.error} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={room.props.id} className={labelClass}>
              Room
            </label>
            <NativeSelect {...room.props} value={task.roomId} disabled={disabled} onChange={(e) => update({ roomId: e.target.value })}>
              <option value="">No room</option>
              {!roomKnown && <option value={task.roomId}>Deleted room</option>}
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError fieldId={room.props.id} message={room.error} />
          </div>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex w-fit items-center gap-1 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Hide details" : "Dates, description & checklist"}
          {task.checklistItems.length > 0 && !expanded ? ` (${task.checklistItems.length} items)` : null}
        </button>

        <div id={detailsId} hidden={!expanded} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={taskFieldId(task.key, "start")} className={labelClass}>
                Planned start
              </label>
              <Input
                id={taskFieldId(task.key, "start")}
                type="date"
                value={isoToDateKey(task.plannedStart)}
                disabled={disabled}
                onChange={(e) => update({ plannedStart: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={end.props.id} className={labelClass}>
                Planned end
              </label>
              <Input
                {...end.props}
                type="date"
                value={isoToDateKey(task.plannedEnd)}
                disabled={disabled}
                onChange={(e) => update({ plannedEnd: e.target.value })}
              />
              <FieldError fieldId={end.props.id} message={end.error} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={description.props.id} className={labelClass}>
              Details
            </label>
            <Textarea
              {...description.props}
              value={task.description}
              rows={2}
              maxLength={TIMELINE_LIMITS.description}
              disabled={disabled}
              onChange={(e) => update({ description: e.target.value })}
            />
            <FieldError fieldId={description.props.id} message={description.error} />
          </div>
          <ChecklistEditor phaseKey={phaseKey} taskKey={task.key} items={task.checklistItems} />
          {phaseOptions.length > 1 && (
            <div className="flex flex-col gap-1 sm:max-w-xs">
              <label htmlFor={`${detailsId}-phase`} className={labelClass}>
                Phase
              </label>
              <NativeSelect
                id={`${detailsId}-phase`}
                value={phaseKey}
                disabled={disabled}
                onChange={(e) => {
                  const to = phaseOptions.find((p) => p.key === e.target.value);
                  dispatch({ type: "moveTaskToPhase", phaseKey, taskKey: task.key, toPhaseKey: e.target.value });
                  announce(`Moved ${label} to ${to?.name || "another phase"}.`);
                  focusAfterRender(title.props.id);
                }}
              >
                {phaseOptions.map((p, i) => (
                  <option key={p.key} value={p.key}>
                    {p.name.trim() || `Phase ${i + 1}`}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
