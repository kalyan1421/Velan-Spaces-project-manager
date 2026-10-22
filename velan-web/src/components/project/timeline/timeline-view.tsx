"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ListTree, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { StateMessage } from "@/components/app-shell/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { projectOps, projectOpsKeys, type Project, type Room, type TimelinePhase } from "@/lib/api/project-ops";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Option } from "./editor-context";
import { TimelineList } from "./timeline-list";
import { canUpdateTimelinePlan, tasksAssignedTo, timelineCounts, type Viewer } from "./timeline-model";
import { TimelineSchedule } from "./timeline-schedule";

// Only head/managers ever load the editor bundle.
const TimelineEditorPanel = dynamic(() => import("./timeline-editor-panel"), {
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
});

/** Lists refresh every 60 s while visible (spec R-F1); paused while editing. */
const TIMELINE_POLL_MS = 60_000;

export type TimelineViewProps = {
  projectId: string;
  viewer: Viewer;
  initialProject: Project;
  initialPhases: TimelinePhase[];
  rooms: Room[];
  /** Project workers (id + name) — empty for roles that can't list staff. */
  workers: Option[];
  /** Hide assignee names (client portal). */
  hideAssignees?: boolean;
};

type Layout = "list" | "schedule";

function SegmentedToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: typeof ListTree }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            value === o.value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
          )}
        >
          {o.icon && <o.icon className="size-4" aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TimelineView({
  projectId,
  viewer,
  initialProject,
  initialPhases,
  rooms,
  workers,
  hideAssignees = false,
}: TimelineViewProps) {
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<Layout>("list");
  const [scope, setScope] = useState<"mine" | "all">(viewer.role === "worker" ? "mine" : "all");

  const timeline = useQuery({
    queryKey: projectOpsKeys.timeline(projectId),
    queryFn: () => projectOps.getTimeline(projectId),
    initialData: initialPhases,
    refetchInterval: editing ? false : TIMELINE_POLL_MS,
    refetchOnWindowFocus: !editing,
  });
  const project = useQuery({
    queryKey: projectOpsKeys.project(projectId),
    queryFn: () => projectOps.getProject(projectId),
    initialData: initialProject,
  });

  const phases = timeline.data;
  const roomNames = useMemo(() => Object.fromEntries(rooms.map((r) => [r.id, r.name])), [rooms]);
  const people = useMemo(() => Object.fromEntries(workers.map((w) => [w.id, w.name])), [workers]);
  const roomOptions = useMemo(() => rooms.map((r) => ({ id: r.id, name: r.name })), [rooms]);
  const visible = useMemo(
    () => (scope === "mine" ? tasksAssignedTo(phases, viewer.id) : phases),
    [phases, scope, viewer.id],
  );
  const counts = timelineCounts(phases);
  const canEdit = canUpdateTimelinePlan(viewer.role);
  const completion = project.data.completionPercentage;

  if (editing) {
    return (
      <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="timeline-heading" className="font-heading text-lg font-semibold text-ink">
            Edit timeline
          </h2>
          <p className="text-sm text-muted-foreground">
            Changes are saved together. Task progress from workers is kept unless you change it here.
          </p>
        </div>
        <TimelineEditorPanel
          projectId={projectId}
          projectStart={project.data.startDate}
          initialPhases={phases}
          workers={workers}
          rooms={roomOptions}
          onClose={() => setEditing(false)}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id="timeline-heading" className="font-heading text-lg font-semibold text-ink">
            Timeline
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar className="max-w-sm flex-1" value={completion} label="Project completion" showValue={false} />
            <span className="text-sm font-medium tabular-nums text-ink">{formatPercent(completion)} complete</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.phases} {counts.phases === 1 ? "phase" : "phases"} · {counts.done} of {counts.tasks} tasks done
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewer.role === "worker" && (
            <SegmentedToggle
              label="Which tasks"
              value={scope}
              onChange={setScope}
              options={[
                { value: "mine", label: "My tasks" },
                { value: "all", label: "All tasks" },
              ]}
            />
          )}
          <SegmentedToggle
            label="Timeline layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: "list", label: "List", icon: ListTree },
              { value: "schedule", label: "Schedule", icon: CalendarRange },
            ]}
          />
          {canEdit && (
            <Button size="lg" onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Edit timeline
            </Button>
          )}
        </div>
      </div>

      {timeline.isError && (
        <p role="status" className="text-sm text-muted-foreground">
          Couldn&apos;t refresh the timeline. Showing the last loaded version.
        </p>
      )}

      {phases.length === 0 ? (
        <StateMessage
          icon={ListTree}
          title="No timeline yet"
          description={
            canEdit
              ? "Plan the work in phases and tasks. Workers see the tasks assigned to them."
              : "The team hasn't published the work plan yet."
          }
          action={
            canEdit ? (
              <Button size="lg" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                Create timeline
              </Button>
            ) : undefined
          }
        />
      ) : layout === "schedule" ? (
        <TimelineSchedule phases={phases} />
      ) : visible.length === 0 ? (
        <StateMessage
          icon={ListTree}
          title="No tasks assigned to you"
          description="When a manager assigns you a task it appears here. Switch to All tasks to see the whole plan."
        />
      ) : (
        <TimelineList
          phases={visible}
          projectId={projectId}
          viewer={viewer}
          roomNames={roomNames}
          people={hideAssignees ? undefined : people}
        />
      )}
    </section>
  );
}
