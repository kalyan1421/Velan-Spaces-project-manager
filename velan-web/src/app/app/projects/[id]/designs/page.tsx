import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignsGallery, DesignsGridSkeleton } from "@/components/project/designs/designs-gallery";
import { loadDesigns } from "@/components/project/media/load-content";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Designs" };

export default function ProjectDesignsPage({ params }: PageProps<"/app/projects/[id]/designs">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-28" />
          <DesignsGridSkeleton />
        </div>
      }
    >
      <DesignsContent params={params} />
    </Suspense>
  );
}

async function DesignsContent({ params }: { params: PageProps<"/app/projects/[id]/designs">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The project layout renders the 403 state for the whole project.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();

  const designs = await loadDesigns(result.project.id);
  if (designs.kind === "forbidden") return <ForbiddenState />;

  // `?design=<id>` (shareable link) is read on the client by the gallery.
  return <DesignsGallery projectId={result.project.id} role={user.role} variant="staff" initialDesigns={designs.data} />;
}
