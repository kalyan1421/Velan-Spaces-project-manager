"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Download, HandCoins, Plus, Search, SearchX } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StateMessage } from "@/components/app-shell/states";
import { ConfirmDeleteDialog } from "@/components/project/budget/confirm-delete-dialog";
import { csvFileName, downloadCsv } from "@/components/project/budget/csv";
import { describeDateRange } from "@/components/project/budget/date-range";
import { DateRangeFilter } from "@/components/project/budget/date-range-filter";
import type { CurrentPerson } from "@/components/project/budget/expense-ledger";
import { LedgerTable, LedgerTotalRow, useLedgerTable, type LedgerFeatures } from "@/components/project/budget/ledger-table";
import { ProofLink } from "@/components/project/budget/proof-link";
import { useDeleteSettlement } from "@/components/project/budget/queries";
import { RowActions } from "@/components/project/budget/row-actions";
import type { SortSpec } from "@/components/project/budget/sort";
import { useUrlState } from "@/components/project/budget/use-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { todayIST, type Settlement } from "@/lib/api/money";
import { formatDate, formatINR } from "@/lib/format";
import { SettlementFormDialog } from "./settlement-form-dialog";
import {
  DEFAULT_SETTLEMENT_FILTERS,
  createdByLabel,
  filterSettlements,
  hasActiveSettlementFilters,
  parseSettlementFilters,
  parseSettlementSort,
  settlementFilterParams,
  settlementsCsv,
  summarizeSettlements,
  type SettlementFilters,
} from "./settlement-ledger";

const col = createColumnHelper<LedgerFeatures, Settlement>();

const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  paidTo: "Paid to",
  description: "Description",
  mode: "Mode",
  amount: "Amount",
  proof: "Proof",
  createdBy: "Created by",
};

const dash = <span className="text-muted-foreground">—</span>;

function rowLabel(s: Settlement): string {
  return `settlement of ${formatINR(s.amount)}${s.paidTo ? ` to ${s.paidTo}` : ""} on ${formatDate(s.date)}`;
}

function buildColumns({
  currentUserId,
  onEdit,
  onDelete,
}: {
  currentUserId: string | null;
  onEdit: (s: Settlement, returnFocus: HTMLElement | null) => void;
  onDelete: (s: Settlement, returnFocus: HTMLElement | null) => void;
}) {
  return col.columns([
    col.accessor("date", {
      header: COLUMN_LABELS.date,
      sortFn: "text",
      cell: (info) => <span className="tabular-nums">{formatDate(info.getValue())}</span>,
    }),
    col.accessor("paidTo", {
      header: COLUMN_LABELS.paidTo,
      sortFn: "text",
      cell: (info) => (info.getValue() ? <span className="font-medium text-ink">{info.getValue()}</span> : dash),
    }),
    col.accessor("description", {
      header: COLUMN_LABELS.description,
      sortFn: "text",
      cell: (info) =>
        info.getValue() ? (
          <span className="block max-w-64 truncate" title={info.getValue()}>
            {info.getValue()}
          </span>
        ) : (
          dash
        ),
    }),
    col.accessor("mode", { header: COLUMN_LABELS.mode, sortFn: "text", cell: (info) => info.getValue() || dash }),
    col.accessor("amount", {
      header: COLUMN_LABELS.amount,
      cell: (info) => <span className="font-medium text-ink">{formatINR(info.getValue())}</span>,
    }),
    col.accessor((r) => (r.proofUrl ? 1 : 0), {
      id: "proof",
      header: COLUMN_LABELS.proof,
      cell: (info) => <ProofLink url={info.row.original.proofUrl} label={rowLabel(info.row.original)} />,
    }),
    col.accessor((r) => createdByLabel(r, currentUserId), {
      id: "createdBy",
      header: COLUMN_LABELS.createdBy,
      sortFn: "text",
    }),
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

const getSettlementId = (r: Settlement) => r.id;
const AMOUNT_INDEX = 4;
const COLUMN_COUNT = 8;

type DialogState =
  | { kind: "closed" }
  | { kind: "form"; settlement: Settlement | null }
  | { kind: "delete"; settlement: Settlement };

export function SettlementsSection({
  projectId,
  projectCode,
  me,
  settlements,
}: {
  projectId: string;
  projectCode: string;
  me: CurrentPerson;
  settlements: Settlement[];
}) {
  const [filters, setParams] = useUrlState(parseSettlementFilters);
  const [sort] = useUrlState(parseSettlementSort);
  const [search, setSearch] = useState(filters.q);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const del = useDeleteSettlement(projectId);

  const setView = useCallback(
    (next: { filters?: SettlementFilters; sort?: SortSpec }) =>
      setParams(settlementFilterParams(next.filters ?? filters, next.sort ?? sort)),
    [setParams, filters, sort],
  );
  const onSortChange = useCallback((next: SortSpec) => setView({ sort: next }), [setView]);
  const onEdit = useCallback((settlement: Settlement, el: HTMLElement | null) => {
    setReturnFocus(el);
    setDialog({ kind: "form", settlement });
  }, []);
  const onDelete = useCallback((settlement: Settlement, el: HTMLElement | null) => {
    setReturnFocus(el);
    setDialog({ kind: "delete", settlement });
  }, []);

  const columns = useMemo(() => buildColumns({ currentUserId: me.id, onEdit, onDelete }), [me.id, onEdit, onDelete]);
  const rows = useMemo(() => filterSettlements(settlements, filters), [settlements, filters]);
  const totals = useMemo(() => summarizeSettlements(rows), [rows]);
  const table = useLedgerTable({ data: rows, columns, sort, onSortChange, getRowId: getSettlementId });

  const filtered = hasActiveSettlementFilters(filters);
  const close = () => setDialog({ kind: "closed" });
  const openCreate = () => {
    setReturnFocus(addButton.current);
    setDialog({ kind: "form", settlement: null });
  };
  const clearFilters = () => {
    setSearch("");
    setView({ filters: DEFAULT_SETTLEMENT_FILTERS });
  };

  const exportCsv = () => {
    const visible = table.getRowModel().rows.map((r) => r.original);
    downloadCsv(csvFileName([projectCode, "settlements"], todayIST()), settlementsCsv(visible, me));
    toast.success(`Exported ${visible.length} ${visible.length === 1 ? "settlement" : "settlements"}`);
  };

  const confirmDelete = async () => {
    if (dialog.kind !== "delete") return;
    try {
      await del.mutateAsync(dialog.settlement.id);
      toast.success("Settlement deleted");
      setReturnFocus(addButton.current);
      close();
    } catch (error) {
      toast.error(
        isApiError(error) && error.status === 403
          ? "You no longer have access to this project's budget."
          : isApiError(error) && error.status === 404
            ? "That settlement was already deleted."
            : "Couldn't delete the settlement. Please try again.",
      );
      close();
    }
  };

  const filterText = [filters.q && `matching "${filters.q}"`, filters.range.preset !== "all" && describeDateRange(filters.range)]
    .filter(Boolean)
    .join(", ");
  const caption = `Settlements${filtered ? ` — ${filterText}` : ""}. Sorted by ${COLUMN_LABELS[sort.id] ?? sort.id}, ${
    sort.desc ? "descending" : "ascending"
  }.`;

  return (
    <section aria-labelledby="settlements-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="settlements-heading" className="font-heading text-lg font-semibold text-ink">
            Payments
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {settlements.length === 0
              ? "Nothing recorded yet."
              : filtered
                ? `Showing ${rows.length} of ${settlements.length} settlements`
                : `${settlements.length} ${settlements.length === 1 ? "settlement" : "settlements"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {settlements.length > 0 && (
            <Button variant="outline" size="lg" onClick={exportCsv} disabled={rows.length === 0}>
              <Download data-icon="inline-start" aria-hidden />
              Export CSV
            </Button>
          )}
          <Button ref={addButton} size="lg" onClick={openCreate}>
            <Plus data-icon="inline-start" aria-hidden />
            Add settlement
          </Button>
        </div>
      </div>

      {settlements.length === 0 ? (
        <StateMessage
          icon={HandCoins}
          title="No settlements yet"
          description="Record payments made to vendors and workers for this project, with a photo or PDF of the receipt."
          action={
            <Button size="lg" onClick={openCreate}>
              <Plus data-icon="inline-start" aria-hidden />
              Add the first settlement
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <form
              role="search"
              className="flex flex-col gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                setView({ filters: { ...filters, q: search } });
              }}
            >
              <label htmlFor="settlement-search" className="text-xs font-medium text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="settlement-search"
                  type="search"
                  value={search}
                  autoComplete="off"
                  placeholder="Paid to, description, mode"
                  className="h-9 w-64 max-w-full bg-card pl-8"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setView({ filters: { ...filters, q: e.target.value.trim().slice(0, 100) } });
                  }}
                />
              </div>
            </form>
            <DateRangeFilter value={filters.range} onChange={(range) => setView({ filters: { ...filters, range } })} />
            {filtered && (
              <Button variant="ghost" className="h-9" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {rows.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title="No settlements match"
              description="Try a different search or date range."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <LedgerTable
              table={table}
              labelledBy="settlements-heading"
              caption={caption}
              align={{ amount: "right" }}
              cellClassName={{ actions: "w-12 text-right" }}
              footer={
                <LedgerTotalRow
                  label={`Total paid (${totals.count} ${totals.count === 1 ? "settlement" : "settlements"})`}
                  value={formatINR(totals.total)}
                  leadingCols={AMOUNT_INDEX}
                  trailingCols={COLUMN_COUNT - AMOUNT_INDEX - 1}
                />
              }
            />
          )}
        </>
      )}

      <SettlementFormDialog
        open={dialog.kind === "form"}
        onOpenChange={(open) => !open && close()}
        projectId={projectId}
        settlement={dialog.kind === "form" ? dialog.settlement : null}
        returnFocus={returnFocus}
      />
      <ConfirmDeleteDialog
        open={dialog.kind === "delete"}
        title="Delete this settlement?"
        description={
          dialog.kind === "delete" ? (
            <>
              {formatINR(dialog.settlement.amount)}
              {dialog.settlement.paidTo ? ` paid to ${dialog.settlement.paidTo}` : ""} on {formatDate(dialog.settlement.date)} will
              be removed{dialog.settlement.proofUrl ? " along with its proof file" : ""}. Project spend is recalculated. This
              can&apos;t be undone.
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
