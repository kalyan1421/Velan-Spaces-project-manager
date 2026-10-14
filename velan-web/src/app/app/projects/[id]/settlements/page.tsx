import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LedgerSkeleton } from "@/components/project/budget/ledger-skeleton";
import { MoneyForbidden, MoneyLoadError } from "@/components/project/budget/money-states";
import { currentPerson, loadSettlements } from "@/components/project/budget/server";
import { SettlementsView } from "@/components/project/settlements/settlements-view";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { isUuid } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Settlements" };

/** Settlements tab (head + managers with budget access); 403 from the API renders the forbidden state. */
export default function SettlementsPage({ params }: PageProps<"/app/projects/[id]/settlements">) {
  return (
    <Suspense fallback={<LedgerSkeleton />}>
      <SettlementsContent params={params} />
    </Suspense>
  );
}

async function SettlementsContent({ params }: { params: PageProps<"/app/projects/[id]/settlements">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [user, project, money] = await Promise.all([getSession(), loadProject(id), loadSettlements(id)]);
  if (project.kind === "forbidden") return null;
  if (project.kind === "missing" || !user) notFound();

  if (money.kind === "forbidden") return <MoneyForbidden projectId={id} />;
  if (money.kind === "missing") notFound();
  if (money.kind === "error") return <MoneyLoadError what="settlements" />;

  const [settlements] = money.data;
  return (
    <SettlementsView
      projectId={id}
      projectCode={project.project.projectCode}
      me={currentPerson(user)}
      initialSettlements={settlements}
    />
  );
}
