import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BudgetView } from "@/components/project/budget/budget-view";
import { LedgerSkeleton } from "@/components/project/budget/ledger-skeleton";
import { MoneyForbidden, MoneyLoadError } from "@/components/project/budget/money-states";
import { currentPerson, loadBudget } from "@/components/project/budget/server";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { isUuid } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Budget" };

/**
 * Budget tab (head + managers with budget access). Summary and expenses are
 * fetched on the server in parallel with the project; a 403 from either renders
 * the forbidden state, so no figure reaches the browser without API approval.
 */
export default function BudgetPage({ params }: PageProps<"/app/projects/[id]/budget">) {
  return (
    <Suspense fallback={<LedgerSkeleton />}>
      <BudgetContent params={params} />
    </Suspense>
  );
}

async function BudgetContent({ params }: { params: PageProps<"/app/projects/[id]/budget">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [user, project, money] = await Promise.all([getSession(), loadProject(id), loadBudget(id)]);
  // The project layout already renders the 403 state for the whole project.
  if (project.kind === "forbidden") return null;
  if (project.kind === "missing" || !user) notFound();

  if (money.kind === "forbidden") return <MoneyForbidden projectId={id} />;
  if (money.kind === "missing") notFound();
  if (money.kind === "error") return <MoneyLoadError what="the budget" />;

  const [summary, expenses] = money.data;
  return (
    <BudgetView
      projectId={id}
      projectCode={project.project.projectCode}
      me={currentPerson(user)}
      initialSummary={summary}
      initialExpenses={expenses}
    />
  );
}
