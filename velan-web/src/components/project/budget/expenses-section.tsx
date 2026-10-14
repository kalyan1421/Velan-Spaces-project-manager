"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, Download, Plus, ReceiptIndianRupee, SearchX } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StateMessage } from "@/components/app-shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isApiError } from "@/lib/api/errors";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
  categoryLabel,
  todayIST,
  type Expense,
  type ExpenseCategory,
} from "@/lib/api/money";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { csvFileName, downloadCsv } from "./csv";
import { describeDateRange } from "./date-range";
import { DateRangeFilter } from "./date-range-filter";
import { ExpenseFormDialog } from "./expense-form-dialog";
import {
  DEFAULT_EXPENSE_FILTERS,
  addedByLabel,
  expenseFilterParams,
  expensesCsv,
  filterExpenses,
  hasActiveExpenseFilters,
  parseExpenseFilters,
  parseExpenseSort,
  summarizeExpenses,
  type CurrentPerson,
  type ExpenseFilters,
  type ExpenseTypeFilter,
} from "./expense-ledger";
import { LedgerTable, LedgerTotalRow, useLedgerTable, type LedgerFeatures } from "./ledger-table";
import { ProofLink } from "./proof-link";
import { useDeleteExpense } from "./queries";
import { RowActions } from "./row-actions";
import type { SortSpec } from "./sort";
import { useUrlState } from "./use-url-state";

const col = createColumnHelper<LedgerFeatures, Expense>();

const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  type: "Type",
  category: "Category",
  amount: "Amount",
  paymentMethod: "Payment method",
  accountDetails: "Account details",
  proof: "Proof",
  addedBy: "Added by",
};

const TYPE_FILTERS: { value: ExpenseTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

const CATEGORY_FILTER_ITEMS = [
  { value: "all", label: "All categories" },
  ...EXPENSE_CATEGORIES.map((value) => ({ value, label: EXPENSE_CATEGORY_LABELS[value] })),
];

function rowLabel(e: Expense): string {
  return `${e.type === "credit" ? "income" : "expense"} of ${formatINR(e.amount)} on ${formatDate(e.date)}`;
}

function TypeBadge({ type }: { type: Expense["type"] }) {
  return type === "credit" ? (
    <Badge variant="secondary">
      <ArrowDownLeft aria-hidden />
      {EXPENSE_TYPE_LABELS.credit}
    </Badge>
  ) : (
    <Badge variant="outline">
      <ArrowUpRight aria-hidden />
      {EXPENSE_TYPE_LABELS.debit}
    </Badge>
  );
}

function buildColumns({
  currentUserId,
  onEdit,
  onDelete,
}: {
  currentUserId: string | null;
  onEdit: (e: Expense, returnFocus: HTMLElement | null) => void;
  onDelete: (e: Expense, returnFocus: HTMLElement | null) => void;
}) {
  return col.columns([
    col.accessor("date", {
      header: COLUMN_LABELS.date,
      sortFn: "text",
      cell: (info) => <span className="tabular-nums">{formatDate(info.getValue())}</span>,
    }),
    col.accessor((r) => EXPENSE_TYPE_LABELS[r.type], {
      id: "type",
      header: COLUMN_LABELS.type,
      sortFn: "text",
      cell: (info) => <TypeBadge type={info.row.original.type} />,
    }),
    col.accessor((r) => categoryLabel(r.category), { id: "category", header: COLUMN_LABELS.category, sortFn: "text" }),
    col.accessor("amount", {
      header: COLUMN_LABELS.amount,
      cell: (info) => <span className="font-medium text-ink">{formatINR(info.getValue())}</span>,
    }),
    col.accessor("paymentMethod", {
      header: COLUMN_LABELS.paymentMethod,
      sortFn: "text",
      cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
    }),
    col.accessor("accountDetails", {
      header: COLUMN_LABELS.accountDetails,
      sortFn: "text",
      cell: (info) =>
        info.getValue() ? (
          <span className="block max-w-56 truncate" title={info.getValue()}>
            {info.getValue()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    col.accessor((r) => (r.proofUrl ? 1 : 0), {
      id: "proof",
      header: COLUMN_LABELS.proof,
      cell: (info) => <ProofLink url={info.row.original.proofUrl} label={rowLabel(info.row.original)} />,
    }),
    col.accessor((r) => addedByLabel(r, currentUserId), { id: "addedBy", header: COLUMN_LABELS.addedBy, sortFn: "text" }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: (info) => (
        <RowActions
          label={rowLabel(info.row.original)}
          onEdit={(el) => onEdit(info.row.original, el)}
          onDelete={(el) => onDelete(info.row.original, el)}
        />
      ),
    }),
  ]);
}

const getExpenseId = (r: Expense) => r.id;

/** Amount column position → footer layout (label spans the columns before it). */
const AMOUNT_INDEX = 3;
const COLUMN_COUNT = 9;

type DialogState = { kind: "closed" } | { kind: "form"; expense: Expense | null } | { kind: "delete"; expense: Expense };

export function ExpensesSection({
  projectId,
  projectCode,
  me,
  expenses,
}: {
  projectId: string;
  projectCode: string;
  me: CurrentPerson;
  expenses: Expense[];
}) {
  const [filters, setParams] = useUrlState(parseExpenseFilters);
  const [sort] = useUrlState(parseExpenseSort);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  // Where focus returns when a dialog closes (state, not a ref: it is read while rendering the dialogs).
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const del = useDeleteExpense(projectId);

  const setView = useCallback(
    (next: { filters?: ExpenseFilters; sort?: SortSpec }) =>
      setParams(expenseFilterParams(next.filters ?? filters, next.sort ?? sort)),
    [setParams, filters, sort],
  );
  const onSortChange = useCallback((next: SortSpec) => setView({ sort: next }), [setView]);

  const onEdit = useCallback((expense: Expense, el: HTMLElement | null) => {
    setReturnFocus(el);
    setDialog({ kind: "form", expense });
  }, []);
  const onDelete = useCallback((expense: Expense, el: HTMLElement | null) => {
    setReturnFocus(el);
    setDialog({ kind: "delete", expense });
  }, []);

  const columns = useMemo(() => buildColumns({ currentUserId: me.id, onEdit, onDelete }), [me.id, onEdit, onDelete]);
  const rows = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
  const totals = useMemo(() => summarizeExpenses(rows), [rows]);
  const table = useLedgerTable({ data: rows, columns, sort, onSortChange, getRowId: getExpenseId });

  const filtered = hasActiveExpenseFilters(filters);
  const openCreate = () => {
    setReturnFocus(addButton.current);
    setDialog({ kind: "form", expense: null });
  };
  const close = () => setDialog({ kind: "closed" });

  const exportCsv = () => {
    const visible = table.getRowModel().rows.map((r) => r.original);
    downloadCsv(csvFileName([projectCode, "expenses"], todayIST()), expensesCsv(visible, me));
    toast.success(`Exported ${visible.length} ${visible.length === 1 ? "entry" : "entries"}`);
  };

  const confirmDelete = async () => {
    if (dialog.kind !== "delete") return;
    const target = dialog.expense;
    try {
      await del.mutateAsync(target.id);
      toast.success(target.type === "credit" ? "Income entry deleted" : "Expense deleted");
      // The row (and its menu button) is gone; send focus to "Add entry".
      setReturnFocus(addButton.current);
      close();
    } catch (error) {
      toast.error(
        isApiError(error) && error.status === 403
          ? "You no longer have access to this project's budget."
          : isApiError(error) && error.status === 404
            ? "That entry was already deleted."
            : "Couldn't delete the entry. Please try again.",
      );
      close();
    }
  };

  const sortLabel = `${COLUMN_LABELS[sort.id] ?? sort.id}, ${sort.desc ? "descending" : "ascending"}`;
  const caption = `Expenses and income${filtered ? ` — ${describeFilters(filters)}` : ""}. Sorted by ${sortLabel}.`;

  return (
    <section aria-labelledby="expenses-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="expenses-heading" className="font-heading text-lg font-semibold text-ink">
            Expenses and income
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {expenses.length === 0
              ? "Nothing recorded yet."
              : filtered
                ? `Showing ${rows.length} of ${expenses.length} entries`
                : `${expenses.length} ${expenses.length === 1 ? "entry" : "entries"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {expenses.length > 0 && (
            <Button variant="outline" size="lg" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" aria-hidden />
              Export CSV
            </Button>
          )}
          <Button ref={addButton} size="lg" onClick={openCreate}>
            <Plus data-icon="inline-start" aria-hidden />
            Add entry
          </Button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <StateMessage
          icon={ReceiptIndianRupee}
          title="No expenses or income yet"
          description="Record money spent on materials, labour and transport, or payments received from the client. Attach a photo of the bill as proof."
          action={
            <Button size="lg" onClick={openCreate}>
              <Plus data-icon="inline-start" aria-hidden />
              Add the first entry
            </Button>
          }
        />
      ) : (
        <>
          <ExpenseToolbar filters={filters} onChange={(next) => setView({ filters: next })} />
          {rows.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title="No entries match these filters"
              description="Try a different type, category or date range."
              action={
                <Button variant="outline" onClick={() => setView({ filters: DEFAULT_EXPENSE_FILTERS })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <LedgerTable
              table={table}
              labelledBy="expenses-heading"
              caption={caption}
              align={{ amount: "right" }}
              cellClassName={{ actions: "w-12 text-right" }}
              footer={
                <>
                  {filters.type !== "income" && (
                    <LedgerTotalRow
                      label={`Total spent (${totals.expenseCount} ${totals.expenseCount === 1 ? "entry" : "entries"})`}
                      value={formatINR(totals.expenseTotal)}
                      leadingCols={AMOUNT_INDEX}
                      trailingCols={COLUMN_COUNT - AMOUNT_INDEX - 1}
                    />
                  )}
                  {filters.type !== "expense" && (
                    <LedgerTotalRow
                      label={`Income received (${totals.incomeCount} ${totals.incomeCount === 1 ? "entry" : "entries"})`}
                      value={formatINR(totals.incomeTotal)}
                      leadingCols={AMOUNT_INDEX}
                      trailingCols={COLUMN_COUNT - AMOUNT_INDEX - 1}
                    />
                  )}
                </>
              }
            />
          )}
        </>
      )}

      <ExpenseFormDialog
        open={dialog.kind === "form"}
        onOpenChange={(open) => !open && close()}
        projectId={projectId}
        expense={dialog.kind === "form" ? dialog.expense : null}
        returnFocus={returnFocus}
      />
      <ConfirmDeleteDialog
        open={dialog.kind === "delete"}
        title={dialog.kind === "delete" && dialog.expense.type === "credit" ? "Delete this income entry?" : "Delete this expense?"}
        description={
          dialog.kind === "delete" ? (
            <>
              {formatINR(dialog.expense.amount)} on {formatDate(dialog.expense.date)}
              {dialog.expense.category ? ` (${categoryLabel(dialog.expense.category)})` : ""} will be removed
              {dialog.expense.proofUrl ? " along with its proof file" : ""}. Project spend is recalculated. This can&apos;t be
              undone.
            </>
          ) : null
        }
        pending={del.isPending}
        onConfirm={confirmDelete}
        onCancel={close}
        returnFocus={returnFocus}
      />
    </section>
  );
}

function describeFilters(filters: ExpenseFilters): string {
  const parts: string[] = [];
  if (filters.type !== "all") parts.push(filters.type === "income" ? "income only" : "expenses only");
  if (filters.category !== "all") parts.push(EXPENSE_CATEGORY_LABELS[filters.category]);
  if (filters.range.preset !== "all") parts.push(describeDateRange(filters.range));
  return parts.join(", ");
}

function ExpenseToolbar({ filters, onChange }: { filters: ExpenseFilters; onChange: (next: ExpenseFilters) => void }) {
  const active = hasActiveExpenseFilters(filters);
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex flex-col gap-1">
        <span id="expense-type-filter" className="text-xs font-medium text-muted-foreground">
          Type
        </span>
        <div role="group" aria-labelledby="expense-type-filter" className="inline-flex h-9 w-fit items-center rounded-lg bg-muted p-0.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={filters.type === t.value}
              onClick={() => onChange({ ...filters, type: t.value })}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                filters.type === t.value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Select
          items={CATEGORY_FILTER_ITEMS}
          value={filters.category}
          onValueChange={(v) => onChange({ ...filters, category: (v ?? "all") as ExpenseCategory | "all" })}
        >
          <SelectPrimitive.Label className="text-xs font-medium text-muted-foreground">Category</SelectPrimitive.Label>
          <SelectTrigger className="h-9 min-w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CATEGORY_FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DateRangeFilter value={filters.range} onChange={(range) => onChange({ ...filters, range })} />

      {active && (
        <Button variant="ghost" className="h-9" onClick={() => onChange(DEFAULT_EXPENSE_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
