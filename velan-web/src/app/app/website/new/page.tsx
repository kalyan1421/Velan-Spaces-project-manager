import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { PortfolioEditor } from "@/components/website-admin/portfolio-editor";
import { PortfolioEditorSkeleton } from "@/components/website-admin/website-skeleton";
import { requireRole } from "@/lib/auth/session";
import { loadPortfolioAdmin, loadProjectOptions } from "../_lib/data";

export const metadata: Metadata = { title: "Add website project" };

export default function NewPortfolioItemPage() {
  return (
    <Suspense fallback={<PortfolioEditorSkeleton />}>
      <NewPortfolioItem />
    </Suspense>
  );
}

async function NewPortfolioItem() {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") {
    return (
      <ForbiddenState
        message="Only the admin can manage the website portfolio."
        backHref="/app/projects"
        backLabel="Back to projects"
      />
    );
  }

  // Existing slugs (for the address preview) and the project picker, in parallel.
  const [portfolio, projects] = await Promise.all([loadPortfolioAdmin(), loadProjectOptions()]);
  if (portfolio.kind === "forbidden") return <ForbiddenState />;

  return (
    <PortfolioEditor
      items={portfolio.kind === "ok" ? portfolio.data : undefined}
      projects={projects.kind === "ok" ? projects.data : null}
    />
  );
}
