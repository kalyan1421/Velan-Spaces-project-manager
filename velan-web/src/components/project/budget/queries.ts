"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import {
  budgetPaths,
  normalizeExpense,
  normalizeSettlement,
  toBudgetHealth,
  type BudgetSummaryRow,
  type ExpenseBody,
  type ExpenseRow,
  type SettlementBody,
  type SettlementRow,
} from "@/lib/api/money";

/**
 * Query keys live under the project so one prefix invalidation refreshes the
 * summary, both ledgers and any other project query after a money change.
 */
export const moneyKeys = {
  project: (projectId: string) => ["projects", projectId] as const,
  summary: (projectId: string) => ["projects", projectId, "budget", "summary"] as const,
  expenses: (projectId: string) => ["projects", projectId, "budget", "expenses"] as const,
  settlements: (projectId: string) => ["projects", projectId, "budget", "settlements"] as const,
};

export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

const toExpenses = (rows: ExpenseRow[]) => (Array.isArray(rows) ? rows.map(normalizeExpense) : []);
const toSettlements = (rows: SettlementRow[]) => (Array.isArray(rows) ? rows.map(normalizeSettlement) : []);

/** Server-rendered data counts as fresh as of first client render. */
function useHydratedAt() {
  const [at] = useState(() => Date.now());
  return at;
}

export function useBudgetSummary(projectId: string, initial: BudgetSummaryRow) {
  const at = useHydratedAt();
  return useQuery({
    queryKey: moneyKeys.summary(projectId),
    queryFn: ({ signal }) => api.get<BudgetSummaryRow>(budgetPaths.summary(projectId), { signal }),
    initialData: initial,
    initialDataUpdatedAt: at,
    select: toBudgetHealth,
  });
}

export function useExpenses(projectId: string, initial: ExpenseRow[]) {
  const at = useHydratedAt();
  return useQuery({
    queryKey: moneyKeys.expenses(projectId),
    queryFn: ({ signal }) => api.get<ExpenseRow[]>(budgetPaths.expenses(projectId), { signal }),
    initialData: initial,
    initialDataUpdatedAt: at,
    select: toExpenses,
  });
}

export function useSettlements(projectId: string, initial: SettlementRow[]) {
  const at = useHydratedAt();
  return useQuery({
    queryKey: moneyKeys.settlements(projectId),
    queryFn: ({ signal }) => api.get<SettlementRow[]>(budgetPaths.settlements(projectId), { signal }),
    initialData: initial,
    initialDataUpdatedAt: at,
    select: toSettlements,
  });
}

/** Refreshes the summary, ledgers and project queries (spend changes server-side). */
export function useInvalidateMoney(projectId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: moneyKeys.project(projectId) }),
        queryClient.invalidateQueries({ queryKey: ["projects"], exact: true }),
      ]).then(() => undefined),
    [queryClient, projectId],
  );
}

export function useSaveExpense(projectId: string) {
  const invalidate = useInvalidateMoney(projectId);
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ExpenseBody }) =>
      id
        ? api.patch<ExpenseRow>(budgetPaths.expense(projectId, id), body)
        : api.post<ExpenseRow>(budgetPaths.expenses(projectId), body),
    onSettled: invalidate,
  });
}

export function useDeleteExpense(projectId: string) {
  const invalidate = useInvalidateMoney(projectId);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(budgetPaths.expense(projectId, id)),
    onSettled: invalidate,
  });
}

export function useSaveSettlement(projectId: string) {
  const invalidate = useInvalidateMoney(projectId);
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: SettlementBody }) =>
      id
        ? api.patch<SettlementRow>(budgetPaths.settlement(projectId, id), body)
        : api.post<SettlementRow>(budgetPaths.settlements(projectId), body),
    onSettled: invalidate,
  });
}

export function useDeleteSettlement(projectId: string) {
  const invalidate = useInvalidateMoney(projectId);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(budgetPaths.settlement(projectId, id)),
    onSettled: invalidate,
  });
}
