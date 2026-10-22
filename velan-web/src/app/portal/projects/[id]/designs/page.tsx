import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignsGallery, DesignsGridSkeleton } from "@/components/project/designs/designs-gallery";
import { loadApprovalDesigns } from "@/components/project/designs/load-designs";
import { PortalSectionHeader } from "@/components/project/media/portal-section-header";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Designs" };

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

  const designs = await loadApprovalDesigns(project.id);
  if (designs.kind === "forbidden") return forbidden;

  // The portal variant has no upload, edit or delete controls; the client can
  // approve or request changes on designs the team asked them to review (R-E4).
  // Quotation PDFs are under Files & documents.
  return (
    <div className="flex flex-col gap-8">
      <PortalSectionHeader
        projectId={project.id}
        projectName={project.projectName}
        title="Designs"
        description="Plans and renders for your home. Tap any design to view or download it, and approve the ones the team sends for your review."
      />
      <DesignsGallery projectId={project.id} role="client" variant="portal" initialDesigns={designs.data} />
    </div>
  );
}
