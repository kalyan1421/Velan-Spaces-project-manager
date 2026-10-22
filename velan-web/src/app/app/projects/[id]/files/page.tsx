import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { FilesTable, FilesTableSkeleton } from "@/components/project/files/files-table";
import { loadSharedFiles } from "@/components/project/files/load-files";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Files" };

export default function ProjectFilesPage({ params }: PageProps<"/app/projects/[id]/files">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-20" />
          <FilesTableSkeleton />
        </div>
      }
    >
      <FilesContent params={params} />
    </Suspense>
  );
}

async function FilesContent({ params }: { params: PageProps<"/app/projects/[id]/files">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The project layout renders the 403 state for the whole project.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();

  const files = await loadSharedFiles(result.project.id);
  if (files.kind === "forbidden") return <ForbiddenState />;

  return <FilesTable projectId={result.project.id} role={user.role} initialFiles={files.data} />;
}
