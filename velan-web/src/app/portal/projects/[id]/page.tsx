import { CalendarDays, ChevronRight, MapPin, PenTool } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { ScrollToHash } from "@/components/app-shell/scroll-to-hash";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { awaitingClientDecision, portalGalleryDesigns } from "@/components/project/designs/design-utils";
import { loadApprovalDesigns } from "@/components/project/designs/load-designs";
import { ClientPaymentsCard } from "@/components/project/payments/client-payments-card";
import { loadClientPayments } from "@/components/project/payments/load-client-payments";
import { SupportView } from "@/components/project/support/support-view";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { formatDate, formatPercent } from "@/lib/format";
import { PORTAL_CHAT_ANCHOR, PORTAL_SECTIONS, portalSectionHref } from "./_components/portal-sections";

export const metadata: Metadata = { title: "Project overview" };

/** Portal project sections linked from the overview (the tab bar has the same list). */
const SECTIONS = PORTAL_SECTIONS.filter((s) => s.segment !== "");

export default function PortalProjectPage({ params }: PageProps<"/portal/projects/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <PortalProject params={params} />
    </Suspense>
  );
}

async function PortalProject({ params }: { params: PageProps<"/portal/projects/[id]">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") {
    return <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />;
  }
  if (result.kind === "missing" || !user) notFound();
  const { project } = result;

  // Designs waiting for the client's decision and the payments card (both best effort).
  const [designs, payments] = await Promise.all([loadApprovalDesigns(project.id), loadClientPayments(project.id)]);
  const awaiting = designs.kind === "ok" && designs.data ? awaitingClientDecision(portalGalleryDesigns(designs.data)).length : 0;

  // Money is budget vs payments received only — never spend or costs (R-B3).
  // Layout: on large screens the chat box sits in a sticky right column; on
  // phones it follows the progress/payments cards and precedes the section links.
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <div className="min-w-0 space-y-6">
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

          {payments.kind === "ok" && payments.data && <ClientPaymentsCard data={payments.data} />}

          {awaiting > 0 && (
            <Link
              href={portalSectionHref(project.id, "designs")}
              className="flex items-center gap-3 rounded-xl bg-gold/10 p-4 ring-1 ring-gold/40 outline-none transition-colors hover:bg-gold/15 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <PenTool className="size-5 shrink-0 text-ink" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {awaiting === 1 ? "1 design is" : `${awaiting} designs are`} waiting for your approval
                </span>
                <span className="block text-xs text-muted-foreground">
                  Review {awaiting === 1 ? "it" : "them"} and approve, or tell the team what to change.
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          )}
        </div>

        <div id={PORTAL_CHAT_ANCHOR} className="min-w-0 scroll-mt-32 lg:sticky lg:top-32 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <SupportView projectId={project.id} viewer={{ id: user.id, role: user.role }} variant="box" />
          <ScrollToHash id={PORTAL_CHAT_ANCHOR} />
        </div>

        <nav aria-label="Project sections" className="min-w-0 lg:col-start-1">
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.segment}>
                <Link
                  href={portalSectionHref(project.id, s.segment)}
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{s.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
