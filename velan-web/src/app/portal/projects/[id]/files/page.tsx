import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { loadApprovalDesigns } from "@/components/project/designs/load-designs";
import { DocumentsList } from "@/components/project/files/documents-list";
import { loadSharedFiles } from "@/components/project/files/load-files";
import { PortalSectionHeader } from "@/components/project/media/portal-section-header";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Files & documents" };

const forbidden = (
  <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />
);

export default function PortalFilesPage({ params }: PageProps<"/portal/projects/[id]/files">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading files">
          <Skeleton className="h-16 w-56" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <PortalFiles params={params} />
    </Suspense>
  );
}

async function PortalFiles({ params }: { params: PageProps<"/portal/projects/[id]/files">["params"] }) {
  const { id } = await params;
  const result = await loadProject(id);
  if (result.kind === "forbidden") return forbidden;
  if (result.kind === "missing") notFound();
  const { project } = result;

  // Read-only. The API returns only files the team shared with the client, plus
  // quotation PDFs attached to the project (stored as designs). Downloads use
  // short-lived signed URLs (R-E3).
  const [designs, files] = await Promise.all([loadApprovalDesigns(project.id), loadSharedFiles(project.id)]);
  if (designs.kind === "forbidden" || files.kind === "forbidden") return forbidden;

  return (
    <div className="flex flex-col gap-8">
      <PortalSectionHeader
        projectId={project.id}
        projectName={project.projectName}
        title="Files & documents"
        description="Quotations and documents your project team has shared with you. Open any item to view it, or download a copy."
      />
      <DocumentsList projectId={project.id} initialDesigns={designs.data} initialFiles={files.data} />
    </div>
  );
}
