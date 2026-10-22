"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { projectOps, projectOpsKeys } from "@/lib/api/project-ops";
import type { Project } from "@/lib/api/types";
import { isProjectEditPath } from "./project-paths";

/**
 * Project title row. Reads the shared project query (seeded by the server), so a
 * save on the edit page or the workers tab updates the header straight away.
 */
export function ProjectHeader({ initialProject, canEdit }: { initialProject: Project; canEdit: boolean }) {
  const pathname = usePathname() ?? "";
  const { data } = useQuery({
    queryKey: projectOpsKeys.project(initialProject.id),
    queryFn: () => projectOps.getProject(initialProject.id),
    initialData: initialProject,
  });
  const project = data ?? initialProject;
  const editing = isProjectEditPath(pathname, project.id);

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-2xl font-semibold tracking-tight text-ink">{project.projectName}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{project.projectCode}</span>
          {project.location && <span aria-hidden>·</span>}
          {project.location && <span>{project.location}</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Badge variant={project.isComplete ? "secondary" : "outline"} className="w-fit">
          {project.isComplete ? "Completed" : "In progress"}
        </Badge>
        {canEdit && !editing && (
          <Link href={`/app/projects/${project.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            <Pencil data-icon="inline-start" aria-hidden />
            Edit project
          </Link>
        )}
      </div>
    </header>
  );
}
