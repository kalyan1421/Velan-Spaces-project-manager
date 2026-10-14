import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { loadRooms, loadUpdatesPage } from "@/components/project/media/load-content";
import { PortalSectionHeader } from "@/components/project/media/portal-section-header";
import { UpdatesFeed } from "@/components/project/updates/updates-feed";
import { UpdatesListSkeleton } from "@/components/project/updates/updates-skeleton";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Updates" };

const forbidden = (
  <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />
);

export default function PortalUpdatesPage({ params }: PageProps<"/portal/projects/[id]/updates">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-16 w-56" />
          <UpdatesListSkeleton count={2} />
        </div>
      }
    >
      <PortalUpdates params={params} />
    </Suspense>
  );
}

async function PortalUpdates({ params }: { params: PageProps<"/portal/projects/[id]/updates">["params"] }) {
  const { id } = await params;
  const result = await loadProject(id);
  if (result.kind === "forbidden") return forbidden;
  if (result.kind === "missing") notFound();
  const { project } = result;

  // The API only returns client-visible updates to clients (R-E1); the portal
  // variant renders no staff controls (no composer, delete or comment box).
  const [updates, rooms] = await Promise.all([loadUpdatesPage(project.id), loadRooms(project.id)]);
  if (updates.kind === "forbidden") return forbidden;

  return (
    <div className="flex flex-col gap-6">
      <PortalSectionHeader
        projectId={project.id}
        projectName={project.projectName}
        title="Updates"
        description="Progress notes and photos from your project team."
      />
      <UpdatesFeed
        projectId={project.id}
        role="client"
        variant="portal"
        initialUpdates={updates.data}
        initialRooms={rooms}
        directory={[]}
        projectWorkerIds={[]}
        showHeading={false}
      />
    </div>
  );
}
