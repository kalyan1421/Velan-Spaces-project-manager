import { CalendarDays, MapPin, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/lib/api/types";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { formatDate, formatINR, formatPercent, toNumber } from "@/lib/format";
import { hasBudgetFields, isOverdue } from "@/lib/projects";

export const metadata: Metadata = { title: "Project" };

export default function ProjectOverviewPage({ params }: PageProps<"/app/projects/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <Overview params={params} />
    </Suspense>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

function BudgetCard({ project }: { project: Project }) {
  const budget = toNumber(project.budget);
  const spent = toNumber(project.currentSpend);
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const over = budget > 0 && spent > budget;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget</CardTitle>
        <CardDescription>Spent includes settlements and expenses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-heading text-2xl font-semibold tabular-nums text-ink">{formatINR(spent)}</p>
          <p className="text-sm text-muted-foreground">
            of <span className="font-medium tabular-nums text-ink">{formatINR(budget)}</span>
          </p>
        </div>
        <ProgressBar value={pct} label="Budget used" tone={over ? "danger" : "default"} />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{over ? "Over budget by" : "Remaining"}</dt>
            <dd className={over ? "font-medium tabular-nums text-destructive" : "font-medium tabular-nums text-ink"}>
              {formatINR(Math.abs(budget - spent))}
            </dd>
          </div>
          {project.estimatedCost !== undefined && (
            <div>
              <dt className="text-xs text-muted-foreground">Estimated cost</dt>
              <dd className="font-medium tabular-nums text-ink">{formatINR(project.estimatedCost)}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

async function Overview({ params }: { params: PageProps<"/app/projects/[id]">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The layout renders the 403 state; nothing more to show here.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();

  const { project } = result;
  const overdue = isOverdue(project, new Date());
  const showBudget = user.role !== "worker" && hasBudgetFields(project);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>Overall completion reported by the team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <p className="font-heading text-3xl font-semibold tabular-nums text-ink">
              {formatPercent(project.completionPercentage)}
            </p>
            {project.isComplete ? (
              <Badge variant="secondary">Completed</Badge>
            ) : overdue ? (
              <Badge variant="destructive">Overdue</Badge>
            ) : null}
          </div>
          <ProgressBar
            value={project.completionPercentage}
            label="Project completion"
            showValue={false}
            tone={project.isComplete ? "success" : "default"}
          />
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail icon={CalendarDays} label="Start date">
              {formatDate(project.startDate)}
            </Detail>
            <Detail icon={CalendarDays} label="Target date">
              {formatDate(project.targetEndDate)}
            </Detail>
            <Detail icon={UserRound} label="Client">
              {project.clientName ?? "—"}
            </Detail>
            <Detail icon={MapPin} label="Location">
              {project.location ?? "—"}
            </Detail>
            {project.clientPhone && (
              <Detail icon={UserRound} label="Client phone">
                <a href={`tel:${project.clientPhone}`} className="underline-offset-4 hover:underline">
                  {project.clientPhone}
                </a>
              </Detail>
            )}
            {project.clientEmail && (
              <Detail icon={UserRound} label="Client email">
                <a href={`mailto:${project.clientEmail}`} className="underline-offset-4 hover:underline">
                  {project.clientEmail}
                </a>
              </Detail>
            )}
          </dl>
        </CardContent>
      </Card>

      {showBudget && <BudgetCard project={project} />}
    </div>
  );
}
