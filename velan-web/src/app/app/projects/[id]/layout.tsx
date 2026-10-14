import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { projectTabsFor } from "@/lib/projects";
import { ProjectTabs } from "./_components/project-tabs";

/**
 * Project frame shared by the overview and every tab page (Wave 2 adds
 * `updates/`, `designs/`, … next to `[tab]/`). Fetches the project once per
 * request (`getProject` is memoised) and renders the header + role-filtered tabs.
 */
export default function ProjectLayout({ children, params }: LayoutProps<"/app/projects/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <ProjectFrame params={params}>{children}</ProjectFrame>
    </Suspense>
  );
}

async function ProjectFrame({
  params,
  children,
}: {
  params: LayoutProps<"/app/projects/[id]">["params"];
  children: React.ReactNode;
}) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);

  if (result.kind === "forbidden") return <ForbiddenState />;
  if (result.kind === "missing" || !user) notFound();

  const { project } = result;
  const tabs = projectTabsFor(user.role, project);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight text-ink">{project.projectName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{project.projectCode}</span>
            {project.location && <span aria-hidden>·</span>}
            {project.location && <span>{project.location}</span>}
          </p>
        </div>
        <Badge variant={project.isComplete ? "secondary" : "outline"} className="w-fit">
          {project.isComplete ? "Completed" : "In progress"}
        </Badge>
      </header>
      <ProjectTabs tabs={tabs} projectName={project.projectName} />
      {children}
    </div>
  );
}
