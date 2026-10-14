import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { PortfolioEditor } from "@/components/website-admin/portfolio-editor";
import { PortfolioEditorSkeleton } from "@/components/website-admin/website-skeleton";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/projects";
import { loadPortfolioAdmin, loadProjectOptions } from "../_lib/data";

export const metadata: Metadata = { title: "Edit website project" };

export default function EditPortfolioItemPage({ params }: PageProps<"/app/website/[id]">) {
  return (
    <Suspense fallback={<PortfolioEditorSkeleton />}>
      {params.then(({ id }) => (
        <EditPortfolioItem id={id} />
      ))}
    </Suspense>
  );
}

async function EditPortfolioItem({ id }: { id: string }) {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") return <ForbiddenState message="Only the admin can manage the website portfolio." />;
  if (!isUuid(id)) notFound();

  // There is no GET /portfolio/:id — the (small, curated) list is the source.
  const [portfolio, projects] = await Promise.all([loadPortfolioAdmin(), loadProjectOptions()]);
  if (portfolio.kind === "forbidden") return <ForbiddenState />;
  // Rendered by app/app/error.tsx with a "Try again" button.
  if (portfolio.kind === "unavailable") throw new Error("The website portfolio couldn't be loaded.");

  const item = portfolio.data.find((i) => i.id === id);
  if (!item) notFound();

  return (
    <PortfolioEditor
      key={item.id}
      item={item}
      items={portfolio.data}
      projects={projects.kind === "ok" ? projects.data : null}
    />
  );
}
