import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { loadRooms, loadUpdatesPage, loadWorkerDirectory } from "@/components/project/media/load-content";
import { UpdatesFeed } from "@/components/project/updates/updates-feed";
import { UpdatesPageSkeleton } from "@/components/project/updates/updates-skeleton";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Updates" };

export default function ProjectUpdatesPage({ params }: PageProps<"/app/projects/[id]/updates">) {
  return (
    <Suspense fallback={<UpdatesPageSkeleton />}>
      <UpdatesContent params={params} />
    </Suspense>
  );
}

async function UpdatesContent({ params }: { params: PageProps<"/app/projects/[id]/updates">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The project layout renders the 403 state for the whole project.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();
  const { project } = result;

  const [updates, rooms, directory] = await Promise.all([
    loadUpdatesPage(project.id),
    loadRooms(project.id),
    loadWorkerDirectory(user.role),
  ]);
  if (updates.kind === "forbidden") return <ForbiddenState />;

  return (
    <UpdatesFeed
      projectId={project.id}
      role={user.role}
      variant="staff"
      initialUpdates={updates.data}
      initialRooms={rooms}
      directory={directory}
      projectWorkerIds={project.workerIds ?? []}
    />
  );
}
