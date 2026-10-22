"use client";

import {
  createSortedRowModel,
  functionalUpdate,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type ReactTable,
  type RowData,
  type SortingState,
  type TableOptions,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortSpec } from "./sort";

/** Client-side sorting only; filtering happens before rows reach the table. */
export const ledgerFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
});
export type LedgerFeatures = typeof ledgerFeatures;
export type LedgerColumns<T extends RowData> = TableOptions<LedgerFeatures, T>["columns"];
export type LedgerTableInstance<T extends RowData> = ReactTable<LedgerFeatures, T>;

/**
 * A sortable TanStack table whose single sort column is controlled by the
 * caller (the URL). Data must be memoised by the caller.
 */
export function useLedgerTable<T extends RowData>({
  data,
  columns,
  sort,
  onSortChange,
  getRowId,
}: {
  data: T[];
  columns: LedgerColumns<T>;
  sort: SortSpec;
  onSortChange: (sort: SortSpec) => void;
  getRowId: (row: T) => string;
}): LedgerTableInstance<T> {
  const sorting = useMemo<SortingState>(() => [{ id: sort.id, desc: sort.desc }], [sort.id, sort.desc]);
  const onSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = functionalUpdate(updater, sorting)[0];
      if (next) onSortChange({ id: next.id, desc: next.desc });
    },
    [sorting, onSortChange],
  );

  return useTable({
    features: ledgerFeatures,
    columns,
    data,
    getRowId,
    state: { sorting },
    onSortingChange,
    enableMultiSort: false,
    enableSortingRemoval: false,
  });
}

type Align = "left" | "right";

/**
 * Accessible table markup for a ledger: focusable scroll region (keyboard users
 * can scroll it), caption, sortable header buttons with `aria-sort`, and a footer.
 */
export function LedgerTable<T extends RowData>({
  table,
  labelledBy,
  caption,
  align = {},
  cellClassName = {},
  footer,
}: {
  table: LedgerTableInstance<T>;
  /** id of the visible heading that names the table. */
  labelledBy: string;
  caption: string;
  align?: Partial<Record<string, Align>>;
  cellClassName?: Partial<Record<string, string>>;
  footer?: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className="relative w-full overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <table data-slot="table" className="w-full caption-bottom text-sm">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header, i) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const right = align[header.column.id] === "right";
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                    className={cn(
                      "text-muted-foreground",
                      right && "text-right",
                      i === 0 && "pl-4",
                      i === group.headers.length - 1 && "pr-4",
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium outline-none transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50",
                          sorted && "text-ink",
                          right && "flex-row-reverse",
                        )}
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const cells = row.getAllCells();
            return (
              <TableRow key={row.id}>
                {cells.map((cell, i) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      align[cell.column.id] === "right" && "text-right tabular-nums",
                      i === 0 && "pl-4",
                      i === cells.length - 1 && "pr-4",
                      cellClassName[cell.column.id],
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
        {footer && <TableFooter>{footer}</TableFooter>}
      </table>
    </div>
  );
}

/** One labelled total row in a ledger footer. */
export function LedgerTotalRow({
  label,
  value,
  leadingCols,
  trailingCols,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Columns spanned by the label (before the amount column). */
  leadingCols: number;
  /** Columns after the amount column. */
  trailingCols: number;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableHead scope="row" colSpan={leadingCols} className="pl-4 font-medium text-ink">
        {label}
      </TableHead>
      <TableCell className="text-right font-semibold tabular-nums text-ink">{value}</TableCell>
      {trailingCols > 0 && <TableCell colSpan={trailingCols} className="pr-4" />}
    </TableRow>
  );
}
