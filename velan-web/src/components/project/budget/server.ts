import "server-only";

import { isApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server";
import { budgetPaths, type BudgetSummaryRow, type ExpenseRow, type SettlementRow } from "@/lib/api/money";
import type { User } from "@/lib/api/types";
import type { CurrentPerson } from "./expense-ledger";

export type MoneyLoad<T> =
  | { kind: "ok"; data: T }
  | { kind: "forbidden" }
  | { kind: "missing" }
  | { kind: "error" };

/**
 * Settles several money calls together: any 403 → forbidden (nothing renders),
 * 400/404 → missing, other API failures → error. Non-API rejections (Next's
 * redirect/refresh signals) are rethrown untouched.
 */
async function settle<T extends unknown[]>(calls: { [K in keyof T]: Promise<T[K]> }): Promise<MoneyLoad<T>> {
  const results = await Promise.allSettled(calls);
  const failures = results.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
  const foreign = failures.find((e) => !isApiError(e));
  if (foreign !== undefined) throw foreign;
  if (failures.some((e) => isApiError(e) && e.status === 403)) return { kind: "forbidden" };
  if (failures.some((e) => isApiError(e) && (e.status === 404 || e.status === 400))) return { kind: "missing" };
  if (failures.length > 0) return { kind: "error" };
  return { kind: "ok", data: results.map((r) => (r as PromiseFulfilledResult<unknown>).value) as T };
}

export function loadBudget(projectId: string): Promise<MoneyLoad<[BudgetSummaryRow, ExpenseRow[]]>> {
  return settle<[BudgetSummaryRow, ExpenseRow[]]>([
    apiFetch<BudgetSummaryRow>(budgetPaths.summary(projectId)),
    apiFetch<ExpenseRow[]>(budgetPaths.expenses(projectId)).then((rows) => (Array.isArray(rows) ? rows : [])),
  ]);
}

export function loadSettlements(projectId: string): Promise<MoneyLoad<[SettlementRow[]]>> {
  return settle<[SettlementRow[]]>([
    apiFetch<SettlementRow[]>(budgetPaths.settlements(projectId)).then((rows) => (Array.isArray(rows) ? rows : [])),
  ]);
}

export function currentPerson(user: User): CurrentPerson {
  return { id: user.id, name: user.displayName?.trim() || user.username || user.email || "You" };
}
