import { CalendarDays, Construction, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadProject } from "@/lib/data/load-project";
import { formatDate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Project overview" };

/** Portal project sections; the pages ship in Wave 2 (see ./[tab]). */
const SECTIONS = [
  { segment: "updates", label: "Updates" },
  { segment: "designs", label: "Designs" },
  { segment: "timeline", label: "Timeline" },
  { segment: "support", label: "Support" },
];

export default function PortalProjectPage({ params }: PageProps<"/portal/projects/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <PortalProject params={params} />
    </Suspense>
  );
}

async function PortalProject({ params }: { params: PageProps<"/portal/projects/[id]">["params"] }) {
  const { id } = await params;
  const result = await loadProject(id);
  if (result.kind === "forbidden") {
    return <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />;
  }
  if (result.kind === "missing") notFound();
  const { project } = result;

  // Deliberately no budget / spend / estimated cost here (R-B3).
  return (
    <div className="space-y-6">
      <SetBreadcrumbs items={[{ label: project.projectName }]} />
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">{project.projectName}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{project.projectCode}</span>
          {project.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {project.location}
            </span>
          )}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <p className="font-heading text-3xl font-semibold tabular-nums text-ink">
              {formatPercent(project.completionPercentage)}
            </p>
            {project.isComplete && <Badge variant="secondary">Completed</Badge>}
          </div>
          <ProgressBar value={project.completionPercentage} label="Project completion" showValue={false} />
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Start date</dt>
                <dd className="text-sm font-medium text-ink">{formatDate(project.startDate)}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Target completion</dt>
                <dd className="text-sm font-medium text-ink">{formatDate(project.targetEndDate)}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      <nav aria-label="Project sections">
        <ul className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.segment}>
              <Link
                href={`/portal/projects/${project.id}/${s.segment}`}
                className="flex h-12 items-center rounded-xl bg-card px-4 text-sm font-medium text-ink ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <StateMessage
        icon={Construction}
        title="More is on the way"
        description="Updates, designs, the timeline and support chat are coming to the web portal soon. Until then, use the Velan Spaces mobile app."
      />
    </div>
  );
}
