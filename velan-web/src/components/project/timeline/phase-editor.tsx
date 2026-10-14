"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TIMELINE_LIMITS } from "@/lib/api/project-ops";
import { FieldError, ReorderButtons, useEditor, useFieldA11y } from "./editor-context";
import { TaskEditor } from "./task-editor";
import { phaseFieldId, taskFieldId, type DraftPhase } from "./timeline-editor";
import { isoToDateKey } from "./timeline-model";

const labelClass = "text-xs font-medium text-ink";

export function PhaseEditor({ phase, index, count }: { phase: DraftPhase; index: number; count: number }) {
  const { dispatch, disabled, announce, focusAfterRender, newKey } = useEditor();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = useFieldA11y(phaseFieldId(phase.key, "name"));
  const start = useFieldA11y(phaseFieldId(phase.key, "start"));
  const end = useFieldA11y(phaseFieldId(phase.key, "end"));
  const label = phase.name.trim() || `phase ${index + 1}`;
  const headingId = `phase-${phase.key}-heading`;
  const tasksFull = phase.tasks.length >= TIMELINE_LIMITS.tasksPerPhase;

  const remove = () => {
    dispatch({ type: "removePhase", phaseKey: phase.key });
    announce(`Removed ${label}${phase.tasks.length ? ` and its ${phase.tasks.length} tasks` : ""}.`);
    focusAfterRender("timeline-add-phase");
  };

  const addTask = () => {
    const key = newKey();
    dispatch({ type: "addTask", phaseKey: phase.key, key });
    announce(`Added a task to ${label}.`);
    focusAfterRender(taskFieldId(key, "title"));
  };

  return (
    <li>
      <section aria-labelledby={headingId} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-2">
          <h3 id={headingId} className="font-heading text-sm font-semibold text-ink">
            Phase {index + 1}
            <span className="sr-only">: {label}</span>
          </h3>
          <div className="flex items-center gap-0.5">
            <ReorderButtons
              idBase={`phase-${phase.key}-move`}
              label={label}
              index={index}
              count={count}
              onMove={(offset) => {
                dispatch({ type: "movePhase", phaseKey: phase.key, offset });
                announce(`Moved ${label} to position ${index + offset + 1} of ${count}.`);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label}`}
              disabled={disabled}
              onClick={() => (phase.tasks.length > 0 ? setConfirmRemove(true) : remove())}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1">
            <label htmlFor={name.props.id} className={labelClass}>
              Phase name
            </label>
            <Input
              {...name.props}
              value={phase.name}
              placeholder="e.g. Civil work"
              maxLength={TIMELINE_LIMITS.phaseName}
              disabled={disabled}
              onChange={(e) => dispatch({ type: "updatePhase", phaseKey: phase.key, patch: { name: e.target.value } })}
            />
            <FieldError fieldId={name.props.id} message={name.error} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={start.props.id} className={labelClass}>
              Start date
            </label>
            <Input
              {...start.props}
              type="date"
              value={isoToDateKey(phase.startDate)}
              disabled={disabled}
              onChange={(e) => dispatch({ type: "updatePhase", phaseKey: phase.key, patch: { startDate: e.target.value } })}
            />
            <FieldError fieldId={start.props.id} message={start.error} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={end.props.id} className={labelClass}>
              End date
            </label>
            <Input
              {...end.props}
              type="date"
              value={isoToDateKey(phase.endDate)}
              min={isoToDateKey(phase.startDate) || undefined}
              disabled={disabled}
              onChange={(e) => dispatch({ type: "updatePhase", phaseKey: phase.key, patch: { endDate: e.target.value } })}
            />
            <FieldError fieldId={end.props.id} message={end.error} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor={`phase-${phase.key}-notes`} className={labelClass}>
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={`phase-${phase.key}-notes`}
            value={phase.notes}
            rows={2}
            maxLength={TIMELINE_LIMITS.description}
            disabled={disabled}
            onChange={(e) => dispatch({ type: "updatePhase", phaseKey: phase.key, patch: { notes: e.target.value } })}
          />
        </div>

        {phase.tasks.length > 0 && (
          <ol aria-label={`Tasks in ${label}`} className="mt-4 flex flex-col gap-2">
            {phase.tasks.map((task, ti) => (
              <TaskEditor key={task.key} phaseKey={phase.key} task={task} index={ti} count={phase.tasks.length} />
            ))}
          </ol>
        )}

        <Button
          id={`phase-${phase.key}-add-task`}
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={disabled || tasksFull}
          onClick={addTask}
        >
          <Plus data-icon="inline-start" />
          Add task
        </Button>
      </section>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {phase.tasks.length} {phase.tasks.length === 1 ? "task" : "tasks"} (with checklists, comments and photo
              proof) will be removed when you save the timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep phase</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmRemove(false);
                remove();
              }}
            >
              Remove phase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
