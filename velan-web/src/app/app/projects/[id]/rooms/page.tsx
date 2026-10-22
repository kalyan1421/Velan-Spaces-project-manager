import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { RoomsManager } from "@/components/project/rooms/rooms-manager";
import { loadRooms } from "@/components/project/timeline/data.server";
import { loadStaff } from "@/components/project/workers/data.server";
import { toPeople } from "@/components/project/workers/workers-model";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Rooms" };

export default function ProjectRoomsPage({ params }: PageProps<"/app/projects/[id]/rooms">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <RoomsContent params={params} />
    </Suspense>
  );
}

async function RoomsContent({ params }: { params: PageProps<"/app/projects/[id]/rooms">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") return null; // the layout shows the 403 state
  if (result.kind === "missing" || !user) notFound();
  if (user.role !== "head" && user.role !== "manager") return <ForbiddenState />;
  const { project } = result;

  const [rooms, staff] = await Promise.all([loadRooms(project.id), loadStaff()]);
  if (rooms.kind === "forbidden") return <ForbiddenState />;

  const onProject = new Set(project.workerIds ?? []);
  const workers = toPeople(staff)
    .filter((p) => p.role === "worker" && onProject.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));

  return <RoomsManager projectId={project.id} initialRooms={rooms.data} workers={workers} />;
}
