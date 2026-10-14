import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { ForbiddenState } from "@/components/app-shell/states";
import { loadRooms, loadTimeline } from "@/components/project/timeline/data.server";
import { TimelineSkeleton } from "@/components/project/timeline/timeline-skeleton";
import { TimelineView } from "@/components/project/timeline/timeline-view";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Timeline" };

const forbidden = (
  <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />
);

/** Client portal timeline: read-only, no assignee names, no money anywhere. */
export default function PortalTimelinePage({ params }: PageProps<"/portal/projects/[id]/timeline">) {
  return (
    <Suspense fallback={<TimelineSkeleton />}>
      <PortalTimeline params={params} />
    </Suspense>
  );
}

async function PortalTimeline({ params }: { params: PageProps<"/portal/projects/[id]/timeline">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") return forbidden;
  if (result.kind === "missing" || !user) notFound();
  const { project } = result;

  const [timeline, rooms] = await Promise.all([loadTimeline(project.id), loadRooms(project.id)]);
  if (timeline.kind === "forbidden") return forbidden;

  return (
    <div className="flex flex-col gap-4">
      <SetBreadcrumbs items={[{ label: project.projectName, href: `/portal/projects/${project.id}` }, { label: "Timeline" }]} />
      <Link href={`/portal/projects/${project.id}`} className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeft aria-hidden />
        {project.projectName}
      </Link>
      <TimelineView
        projectId={project.id}
        viewer={{ id: user.id, role: user.role }}
        initialProject={project}
        initialPhases={timeline.data}
        rooms={rooms.kind === "ok" ? rooms.data : []}
        workers={[]}
        hideAssignees
      />
    </div>
  );
}
