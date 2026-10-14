import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignsGallery, DesignsGridSkeleton } from "@/components/project/designs/designs-gallery";
import { DocumentsList } from "@/components/project/files/documents-list";
import { loadDesigns, loadFiles } from "@/components/project/media/load-content";
import { PortalSectionHeader } from "@/components/project/media/portal-section-header";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Designs & documents" };

const forbidden = (
  <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />
);

export default function PortalDesignsPage({ params }: PageProps<"/portal/projects/[id]/designs">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-16 w-56" />
          <DesignsGridSkeleton />
        </div>
      }
    >
      <PortalDesigns params={params} />
    </Suspense>
  );
}

async function PortalDesigns({ params }: { params: PageProps<"/portal/projects/[id]/designs">["params"] }) {
  const { id } = await params;
  const result = await loadProject(id);
  if (result.kind === "forbidden") return forbidden;
  if (result.kind === "missing") notFound();
  const { project } = result;

  const [designs, files] = await Promise.all([loadDesigns(project.id), loadFiles(project.id)]);
  if (designs.kind === "forbidden" || files.kind === "forbidden") return forbidden;

  // Read-only: the portal variant renders no upload, edit or delete controls.
  return (
    <div className="flex flex-col gap-8">
      <PortalSectionHeader
        projectId={project.id}
        projectName={project.projectName}
        title="Designs & documents"
        description="Plans, renders, quotations and documents shared with you. Tap any item to view or download it."
      />
      <DesignsGallery projectId={project.id} role="client" variant="portal" initialDesigns={designs.data} />
      <DocumentsList projectId={project.id} initialDesigns={designs.data} initialFiles={files.data} />
    </div>
  );
}
