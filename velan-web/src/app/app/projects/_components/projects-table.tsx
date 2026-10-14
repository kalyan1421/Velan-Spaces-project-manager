import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Project } from "@/lib/api/types";
import { formatDate, formatINR, formatINRCompact, toNumber } from "@/lib/format";
import { hasBudgetFields, isOverdue } from "@/lib/projects";
import { cn } from "@/lib/utils";

function Money({ value, danger = false }: { value: unknown; danger?: boolean }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={formatINR(value)} className={cn("tabular-nums", danger && "font-medium text-destructive")}>
      {formatINRCompact(value)}
    </span>
  );
}

function TargetDate({ project, now }: { project: Project; now: Date }) {
  const overdue = isOverdue(project, now);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums">{formatDate(project.targetEndDate)}</span>
      {project.isComplete ? (
        <Badge variant="secondary">Completed</Badge>
      ) : overdue ? (
        <Badge variant="destructive">Overdue</Badge>
      ) : null}
    </span>
  );
}

function isOverBudget(p: Project) {
  return p.budget !== undefined && p.currentSpend !== undefined && toNumber(p.currentSpend) > toNumber(p.budget) && toNumber(p.budget) > 0;
}

/** Projects as a table (≥768px) and as cards (phones). Budget columns only when the API sent them. */
export function ProjectsTable({ projects, now }: { projects: Project[]; now: Date }) {
  const showMoney = projects.some(hasBudgetFields);

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-44">Progress</TableHead>
              <TableHead>Target date</TableHead>
              {showMoney && <TableHead className="text-right">Budget</TableHead>}
              {showMoney && <TableHead className="pr-4 text-right">Spent</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} className="relative">
                <TableCell className="max-w-72 pl-4">
                  <Link
                    href={`/app/projects/${p.id}`}
                    className="block truncate font-medium text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                  >
                    {p.projectName}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">{p.projectCode}</span>
                </TableCell>
                <TableCell className="max-w-48 truncate">{p.clientName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="max-w-48 truncate">{p.location ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <ProgressBar
                    value={p.completionPercentage}
                    label={`${p.projectName} progress`}
                    tone={p.isComplete ? "success" : "default"}
                  />
                </TableCell>
                <TableCell>
                  <TargetDate project={p} now={now} />
                </TableCell>
                {showMoney && (
                  <TableCell className="text-right">
                    <Money value={p.budget} />
                  </TableCell>
                )}
                {showMoney && (
                  <TableCell className="pr-4 text-right">
                    <Money value={p.currentSpend} danger={isOverBudget(p)} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/projects/${p.id}`}
              className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{p.projectName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.projectCode}</p>
                </div>
                {showMoney && hasBudgetFields(p) && (
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <Money value={p.currentSpend} danger={isOverBudget(p)} /> of <Money value={p.budget} />
                  </span>
                )}
              </div>
              <ProgressBar
                className="mt-3"
                value={p.completionPercentage}
                label={`${p.projectName} progress`}
                tone={p.isComplete ? "success" : "default"}
              />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {p.clientName && <span>{p.clientName}</span>}
                {p.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {p.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  <TargetDate project={p} now={now} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
