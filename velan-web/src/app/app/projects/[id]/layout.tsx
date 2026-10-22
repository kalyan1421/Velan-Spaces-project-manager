import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { projectTabsFor } from "@/lib/projects";
import { ProjectHeader } from "./_components/project-header";
import { ProjectTabs } from "./_components/project-tabs";

/**
 * Project frame shared by the overview and every tab page (Wave 2 adds
 * `updates/`, `designs/`, … next to `[tab]/`; `edit/` is the project form). Fetches
 * the project once per request (`getProject` is memoised) and renders the header
 * (with "Edit project" for head/manager) + role-filtered tabs.
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
  // PATCH /projects/:id is head/manager (and the API checks membership).
  const canEdit = user.role === "head" || user.role === "manager";

  return (
    <div className="space-y-5">
      <ProjectHeader initialProject={project} canEdit={canEdit} />
      <ProjectTabs tabs={tabs} projectName={project.projectName} projectId={project.id} />
      {children}
    </div>
  );
}
