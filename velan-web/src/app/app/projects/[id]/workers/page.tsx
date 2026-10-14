import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { loadStaff } from "@/components/project/workers/data.server";
import { WorkersManager } from "@/components/project/workers/workers-manager";
import { toPeople } from "@/components/project/workers/workers-model";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Workers" };

export default function ProjectWorkersPage({ params }: PageProps<"/app/projects/[id]/workers">) {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <WorkersContent params={params} />
    </Suspense>
  );
}

async function WorkersContent({ params }: { params: PageProps<"/app/projects/[id]/workers">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") return null; // the layout shows the 403 state
  if (result.kind === "missing" || !user) notFound();
  // Workers tab is head/manager only (R-D3: hidden tab URLs answer 403).
  if (user.role !== "head" && user.role !== "manager") return <ForbiddenState />;

  const staff = await loadStaff();
  const people = toPeople(staff).filter((p) => p.role === "worker");
  return <WorkersManager initialProject={result.project} people={people} />;
}
