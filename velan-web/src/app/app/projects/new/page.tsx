import type { Metadata } from "next";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ProjectForm } from "@/components/project/form/project-form";
import { loadStaff } from "@/components/project/workers/data.server";
import { toPeople } from "@/components/project/workers/workers-model";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New project" };

/** Single-page create form (head and managers). The API makes a manager the project's manager. */
export default function NewProjectPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={5} />}>
      <NewProjectContent />
    </Suspense>
  );
}

async function NewProjectContent() {
  const user = await requireRole(["head", "manager"]);
  // Head gets managers + workers; the API only ever gives managers workers.
  const staff = toPeople(await loadStaff());

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <SetBreadcrumbs items={[{ label: "Projects", href: "/app/projects" }, { label: "New project" }]} />
      <PageHeader
        title="New project"
        description={
          user.role === "head"
            ? "Add the details you have now — everything except the name and code can be changed later."
            : "You'll be the manager of this project. Everything except the name and code can be filled in later."
        }
      />
      <ProjectForm mode="create" role={user.role} canSeeBudget staff={staff} />
    </div>
  );
}
