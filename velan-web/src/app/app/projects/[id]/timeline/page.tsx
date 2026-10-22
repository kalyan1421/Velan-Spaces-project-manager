import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { loadRooms, loadTimeline } from "@/components/project/timeline/data.server";
import { TimelineSkeleton } from "@/components/project/timeline/timeline-skeleton";
import { TimelineView } from "@/components/project/timeline/timeline-view";
import { loadStaff } from "@/components/project/workers/data.server";
import { toPeople } from "@/components/project/workers/workers-model";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Timeline" };

export default function ProjectTimelinePage({ params }: PageProps<"/app/projects/[id]/timeline">) {
  return (
    <Suspense fallback={<TimelineSkeleton />}>
      <TimelineContent params={params} />
    </Suspense>
  );
}

async function TimelineContent({ params }: { params: PageProps<"/app/projects/[id]/timeline">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The project layout already renders the 403 state.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();
  const { project } = result;

  const canListStaff = user.role === "head" || user.role === "manager";
  const [timeline, rooms, staff] = await Promise.all([
    loadTimeline(project.id),
    loadRooms(project.id),
    canListStaff ? loadStaff() : Promise.resolve([]),
  ]);
  if (timeline.kind === "forbidden") return <ForbiddenState />;

  // Assignable people = the project's workers (names from the staff directory).
  const onProject = new Set(project.workerIds ?? []);
  const workers = toPeople(staff)
    .filter((p) => p.role === "worker" && onProject.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <TimelineView
      projectId={project.id}
      viewer={{ id: user.id, role: user.role }}
      initialProject={project}
      initialPhases={timeline.data}
      rooms={rooms.kind === "ok" ? rooms.data : []}
      workers={workers}
    />
  );
}
