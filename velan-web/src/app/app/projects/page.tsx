import { FolderKanban, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import type { Project, Role } from "@/lib/api/types";
import { getSession } from "@/lib/auth/session";
import { getProjects } from "@/lib/data/projects";
import { filterProjects, parseProjectFilters } from "@/lib/projects";
import { ProjectsTable } from "./_components/projects-table";
import { ProjectsToolbar } from "./_components/projects-toolbar";

export const metadata: Metadata = { title: "Projects" };

const canCreate = (role: Role | undefined) => role === "head" || role === "manager";

export default function ProjectsPage({ searchParams }: PageProps<"/app/projects">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectsContent searchParams={searchParams} />
    </Suspense>
  );
}

function NewProjectButton() {
  return (
    <Link href="/app/projects/new" className={buttonVariants({ size: "lg" })}>
      <Plus aria-hidden />
      New project
    </Link>
  );
}

async function ProjectsContent({ searchParams }: { searchParams: PageProps<"/app/projects">["searchParams"] }) {
  const [user, params] = await Promise.all([getSession(), searchParams]);
  const filters = parseProjectFilters(params);

  let projects: Project[];
  try {
    projects = await getProjects();
  } catch (error) {
    if (isApiError(error) && error.status === 403) return <ForbiddenState backHref="/app/profile" backLabel="Go to profile" />;
    throw error;
  }

  const visible = filterProjects(projects, filters);
  const creatable = canCreate(user?.role);
  const filtered = filters.q !== "" || filters.status !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={
          projects.length === 0
            ? undefined
            : filtered
              ? `Showing ${visible.length} of ${projects.length} projects`
              : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
        }
        actions={creatable ? <NewProjectButton /> : undefined}
      />

      {projects.length === 0 ? (
        <StateMessage
          icon={FolderKanban}
          title="No projects yet"
          description={
            creatable
              ? "Create your first project to start tracking progress, updates and budget."
              : "When you're added to a project, it will show up here."
          }
          action={creatable ? <NewProjectButton /> : undefined}
        />
      ) : (
        <>
          <ProjectsToolbar q={filters.q} status={filters.status} />
          {visible.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title="No projects match"
              description="Try a different search or status."
              action={
                <Link href="/app/projects" className={buttonVariants({ variant: "outline" })}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <ProjectsTable projects={visible} now={new Date()} />
          )}
        </>
      )}
    </div>
  );
}
