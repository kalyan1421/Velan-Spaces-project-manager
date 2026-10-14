import type { TimelinePhase } from "@/lib/api/project-ops";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PHASE_STATUS_LABEL, normalizePhaseStatus, scheduleBars } from "./timeline-model";

/** Gantt-lite: one bar per phase across the overall date span (P1 upgrade, read-only). */
export function TimelineSchedule({ phases }: { phases: TimelinePhase[] }) {
  const { range, items } = scheduleBars(phases);
  if (!range) {
    return <p className="text-sm text-muted-foreground">Add start and end dates to phases to see the schedule.</p>;
  }
  const statusOf = new Map(phases.map((p) => [p.id, normalizePhaseStatus(p.status)]));

  return (
    <figure className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <figcaption className="mb-3 flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(range.start)}</span>
        <span>{formatDate(range.end)}</span>
      </figcaption>
      <ol className="flex flex-col gap-3">
        {items.map((bar) => {
          const status = statusOf.get(bar.id) ?? "pending";
          return (
            <li key={bar.id} className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-3">
              <span className="truncate text-sm font-medium text-ink">{bar.name}</span>
              <div className="relative h-6 rounded-md bg-muted" aria-hidden>
                <div
                  className={cn(
                    "absolute inset-y-0 rounded-md",
                    status === "completed" ? "bg-success/70" : status === "inProgress" ? "bg-gold" : "bg-ink/25",
                  )}
                  style={{ left: `${bar.offset}%`, width: `${Math.max(bar.width, 1.5)}%` }}
                />
              </div>
              <span className="sr-only">
                {formatDate(bar.start)} to {formatDate(bar.end)}, {PHASE_STATUS_LABEL[status]}
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
