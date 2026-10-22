"use client";

import { EyeOff, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import type { CatalogItem } from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";
import {
  TYPE_PLURALS,
  TYPE_PRICING_COPY,
  VARIANT_NOUN,
  rateUnit,
  type CatalogGroup,
} from "./catalog-model";

export type CatalogAction = "edit" | "deactivate" | "activate";

type Props = {
  group: CatalogGroup;
  /** Managers see the rate card without actions. */
  readOnly: boolean;
  busyId: string | null;
  onAction: (action: CatalogAction, item: CatalogItem) => void;
};

function StatusBadge({ item }: { item: CatalogItem }) {
  return item.active ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}

/** "Carcass • Premium ₹1,650" chips; the unit is shown once in the column header / card. */
function Variants({ item }: { item: CatalogItem }) {
  if (item.variants.length === 0) return <span className="text-sm text-muted-foreground">No rates yet</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={`${VARIANT_NOUN[item.itemType]}s and rates`}>
      {item.variants.map((v, i) => (
        <li
          key={`${v.label}-${i}`}
          className="inline-flex max-w-full items-baseline gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs ring-1 ring-foreground/5"
        >
          <span className="truncate text-ink">{v.label || "Unnamed"}</span>
          <span className="shrink-0 font-medium tabular-nums text-ink">{formatINR(v.rate)}</span>
        </li>
      ))}
    </ul>
  );
}

function RowActions({ item, busy, onAction }: { item: CatalogItem; busy: boolean; onAction: Props["onAction"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${item.name}`}
        disabled={busy}
        className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-expanded:bg-muted"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAction("edit", item)}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          {item.active ? (
            <DropdownMenuItem variant="destructive" onClick={() => onAction("deactivate", item)}>
              <EyeOff aria-hidden />
              Deactivate…
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onAction("activate", item)}>
              <RotateCcw aria-hidden />
              Make active again
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const headingId = (type: string) => `rate-card-${type}`;

/** One item type: a table with section sub-headings (≥768px) and cards (phones). */
export function CatalogGroupTable({ group, readOnly, busyId, onAction }: Props) {
  const unit = group.type === "service" ? "per UOM" : rateUnit(group.type).replace("/", "per ");
  return (
    <section aria-labelledby={headingId(group.type)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId(group.type)} className="font-heading text-lg font-semibold text-ink">
          {TYPE_PLURALS[group.type]}{" "}
          <span className="text-sm font-normal tabular-nums text-muted-foreground">({group.count})</span>
        </h2>
        <p className="text-xs text-muted-foreground">{TYPE_PRICING_COPY[group.type]}</p>
      </div>

      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[32%] pl-4">Item</TableHead>
              {group.type === "service" && <TableHead className="w-24">Unit</TableHead>}
              <TableHead>
                {VARIANT_NOUN[group.type] === "Brand" ? "Brands" : `${VARIANT_NOUN[group.type]}s`} · ₹ {unit}
              </TableHead>
              <TableHead className="w-24">Status</TableHead>
              {!readOnly && (
                <TableHead className="w-14 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.sections.map(({ section, items }) => (
              <Fragment key={section}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell
                    colSpan={(group.type === "service" ? 4 : 3) + (readOnly ? 0 : 1)}
                    className="py-1.5 pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    scope="colgroup"
                  >
                    {section}
                  </TableCell>
                </TableRow>
                {items.map((item) => (
                  <TableRow key={item.id}className={cn(!item.active && "text-muted-foreground")}>
                    <TableCell className="pl-4 align-top whitespace-normal">
                      <span className={cn("block font-medium break-words", item.active ? "text-ink" : "text-muted-foreground")}>
                        {item.name || "Unnamed item"}
                      </span>
                      {item.description && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.description}</span>
                      )}
                    </TableCell>
                    {group.type === "service" && (
                      <TableCell className="align-top">{item.uom || <span className="text-muted-foreground">—</span>}</TableCell>
                    )}
                    <TableCell className="align-top whitespace-normal">
                      <Variants item={item} />
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusBadge item={item} />
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="pr-4 text-right align-top">
                        <RowActions item={item} busy={busyId === item.id} onAction={onAction} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {group.sections.map(({ section, items }) => (
          <div key={section} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section}</h3>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id}className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn("font-medium break-words", item.active ? "text-ink" : "text-muted-foreground")}>
                        {item.name || "Unnamed item"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ₹ {group.type === "service" ? (item.uom ? `per ${item.uom}` : "per unit") : unit}
                        {item.description ? ` · ${item.description}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusBadge item={item} />
                      {!readOnly && <RowActions item={item} busy={busyId === item.id} onAction={onAction} />}
                    </div>
                  </div>
                  <div className="mt-2">
                    <Variants item={item} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
