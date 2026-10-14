"use client";

import { CalendarDays } from "lucide-react";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import type { TimelinePhase } from "@/lib/api/project-ops";
import { formatDate } from "@/lib/format";
import { PhaseStatusBadge } from "./status-badges";
import { TaskItem } from "./task-item";
import { normalizePhaseStatus, phaseProgress, type Viewer } from "./timeline-model";

export type TimelineListProps = {
  phases: TimelinePhase[];
  projectId: string;
  viewer: Viewer;
  roomNames: Record<string, string>;
  /** id → name. Omit to hide assignees (client portal). */
  people?: Record<string, string>;
};

/** Read view: phases in order, each with its tasks. Progress controls appear where the viewer may use them. */
export function TimelineList({ phases, projectId, viewer, roomNames, people }: TimelineListProps) {
  return (
    <ol className="flex flex-col gap-4">
      {phases.map((phase, index) => {
        const { done, total } = phaseProgress(phase);
        const headingId = `phase-${phase.id}-heading`;
        return (
          <li key={phase.id}>
            <section aria-labelledby={headingId} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Phase {index + 1}</p>
                  <h3 id={headingId} className="font-heading text-base font-semibold text-ink">
                    {phase.name}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {formatDate(phase.startDate)} – {formatDate(phase.endDate)}
                  </p>
                </div>
                <PhaseStatusBadge status={normalizePhaseStatus(phase.status)} />
              </header>
              {phase.notes && <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">{phase.notes}</p>}
              {total > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar className="flex-1" value={(done / total) * 100} label={`${phase.name} tasks done`} showValue={false} />
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {done} of {total} done
                  </span>
                </div>
              )}
              {total === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No tasks in this phase yet.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {phase.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      projectId={projectId}
                      viewer={viewer}
                      roomName={task.roomId ? (roomNames[task.roomId] ?? null) : null}
                      assigneeName={
                        people === undefined
                          ? undefined
                          : task.assignedWorkerId
                            ? (people[task.assignedWorkerId] ?? "Assigned")
                            : null
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          </li>
        );
      })}
    </ol>
  );
}
