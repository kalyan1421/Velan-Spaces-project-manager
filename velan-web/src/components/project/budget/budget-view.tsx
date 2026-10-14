"use client";

import type { BudgetSummaryRow, ExpenseRow } from "@/lib/api/money";
import { BudgetSummaryCard } from "./budget-summary";
import type { CurrentPerson } from "./expense-ledger";
import { ExpensesSection } from "./expenses-section";
import { MoneyForbidden, StaleDataAlert } from "./money-states";
import { isForbidden, useBudgetSummary, useExpenses } from "./queries";

/**
 * Budget tab. Starts from server-fetched data (so money only ever renders after
 * the API has confirmed access) and keeps it fresh with TanStack Query.
 */
export function BudgetView({
  projectId,
  projectCode,
  me,
  initialSummary,
  initialExpenses,
}: {
  projectId: string;
  projectCode: string;
  me: CurrentPerson;
  initialSummary: BudgetSummaryRow;
  initialExpenses: ExpenseRow[];
}) {
  const summary = useBudgetSummary(projectId, initialSummary);
  const expenses = useExpenses(projectId, initialExpenses);

  // Access can be revoked mid-session: hide every figure as soon as the API says 403.
  if (isForbidden(summary.error) || isForbidden(expenses.error)) return <MoneyForbidden projectId={projectId} />;

  const stale = summary.isError || expenses.isError;
  const retrying = summary.isFetching || expenses.isFetching;

  return (
    <div className="flex flex-col gap-6">
      {stale && (
        <StaleDataAlert
          retrying={retrying}
          onRetry={() => {
            void summary.refetch();
            void expenses.refetch();
          }}
        />
      )}
      <BudgetSummaryCard health={summary.data} projectId={projectId} />
      <ExpensesSection projectId={projectId} projectCode={projectCode} me={me} expenses={expenses.data} />
    </div>
  );
}
