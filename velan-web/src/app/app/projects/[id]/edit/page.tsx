import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { DeleteProjectSection } from "@/components/project/form/delete-project-dialog";
import { ProjectForm } from "@/components/project/form/project-form";
import { loadProjectMembers } from "@/components/project/media/load-content";
import { loadStaff } from "@/components/project/workers/data.server";
import { toPeople } from "@/components/project/workers/workers-model";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { hasBudgetFields } from "@/lib/projects";

export const metadata: Metadata = { title: "Edit project" };

/**
 * Edit a project (head, and managers on it). A static segment, so it wins over
 * the `[tab]` placeholder route. `#budget` / `#members` land on that section.
 */
export default function EditProjectPage({ params }: PageProps<"/app/projects/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton rows={5} />}>
      <EditProjectContent params={params} />
    </Suspense>
  );
}

async function EditProjectContent({ params }: { params: PageProps<"/app/projects/[id]/edit">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The project layout renders the 403 state for the whole project.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();
  if (user.role !== "head" && user.role !== "manager") {
    return <ForbiddenState backHref={`/app/projects/${id}`} backLabel="Back to the project" message="Only the administrator and the project's managers can edit a project." />;
  }

  const { project } = result;
  const [staff, members] = await Promise.all([loadStaff(), loadProjectMembers(project.id)]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink">Edit project</h2>
        <p className="text-sm text-muted-foreground">Changes apply for everyone on the project as soon as you save.</p>
      </div>
      <ProjectForm
        // Remount with fresh defaults whenever the saved project changes.
        key={project.updatedAt ?? project.createdAt}
        mode="edit"
        role={user.role}
        project={project}
        canSeeBudget={hasBudgetFields(project)}
        staff={toPeople(staff)}
        members={members}
      />
      {user.role === "head" && (
        <DeleteProjectSection projectId={project.id} projectCode={project.projectCode} projectName={project.projectName} />
      )}
    </div>
  );
}
