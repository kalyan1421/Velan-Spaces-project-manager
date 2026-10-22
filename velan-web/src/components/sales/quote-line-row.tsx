"use client";

import { AlertTriangle, Copy, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";
import { NativeSelect } from "@/components/project/form/native-select";
import { Button } from "@/components/ui/button";
import type { CatalogItem, QuoteItem } from "@/lib/api/sales-types";
import { formatINR } from "@/lib/format";
import { areaSqft, itemBasis, itemFromCatalog } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";
import { NumberInput } from "./number-input";
import type { DraftItem } from "./quote-draft";
import type { QuoteIssues } from "./quote-form-schema";

const CUSTOM = "__custom__";

/** Shared grid so the header row and every line line up (≥768px). */
export const LINE_GRID =
  "md:grid md:grid-cols-[1.75rem_minmax(0,2.3fr)_minmax(0,1.5fr)_minmax(0,1.9fr)_minmax(0,1fr)_minmax(0,1fr)_4.25rem] md:items-start md:gap-2";

function groupCatalog(items: CatalogItem[]): [string, CatalogItem[]][] {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = item.defaultSection?.trim() || "Other";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
}

function rateSuffix(item: QuoteItem): string {
  const basis = itemBasis(item);
  if (basis === "area") return "/sq.ft";
  if (basis === "uom") return item.uom ? `/${item.uom}` : "";
  return " each";
}

/**
 * One quote line: rate-card item → variant → size (components) or qty
 * (accessories/services). The amount recomputes as you type. Enter in a size
 * or qty field adds the next line.
 */
export function QuoteLineRow({
  item,
  index,
  catalog,
  catalogById,
  round,
  issues,
  autoFocus,
  onFocused,
  onChange,
  onRemove,
  onDuplicate,
  onEnter,
}: {
  item: DraftItem;
  index: number;
  /** Active rate-card items of this section's type. */
  catalog: CatalogItem[];
  catalogById: Map<string, CatalogItem>;
  round: boolean;
  issues: QuoteIssues;
  autoFocus: boolean;
  onFocused: () => void;
  onChange: (patch: Partial<QuoteItem>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onEnter: () => void;
}) {
  const ids = useId();
  const itemRef = useRef<HTMLSelectElement | null>(null);
  const groups = useMemo(() => groupCatalog(catalog), [catalog]);
  const source = item.catalogItemId ? catalogById.get(item.catalogItemId) : undefined;
  const basis = itemBasis(item);
  const n = index + 1;
  const issue = (field: string) => issues[`line:${item.key}:${field}`];
  const currentVariant = source?.variants.find((v) => v.label === item.variantLabel);
  const staleRate = currentVariant && currentVariant.rate !== item.rate ? currentVariant.rate : null;
  const missing = Boolean(item.catalogItemId) && !source;
  const picked = Boolean(item.catalogItemId) || item.name.trim() !== "";

  useEffect(() => {
    if (!autoFocus) return;
    itemRef.current?.focus();
    onFocused();
  }, [autoFocus, onFocused]);

  const itemValue = item.catalogItemId ?? (item.name ? CUSTOM : "");
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnter();
    }
  };

  const pick = (id: string) => {
    const c = catalogById.get(id);
    if (!c) return;
    onChange(
      itemFromCatalog(c, {
        lengthMm: item.lengthMm,
        heightMm: item.heightMm,
        qty: item.qty ?? 1,
        round,
      }),
    );
  };

  const fieldError = (field: string) => {
    const msg = issue(field);
    return msg ? (
      <p id={`${ids}-${field}-error`} className="mt-1 text-xs font-medium text-destructive">
        {msg}
      </p>
    ) : null;
  };
  const aria = (field: string) => ({
    "aria-invalid": issue(field) ? true : undefined,
    "aria-describedby": issue(field) ? `${ids}-${field}-error` : undefined,
  });

  return (
    <li className={cn("relative flex flex-col gap-2 border-b py-3 last:border-b-0 md:py-2", LINE_GRID)}>
      <span className="hidden pt-1.5 text-right text-xs text-muted-foreground tabular-nums md:block" aria-hidden>
        {n}
      </span>

      {/* Item */}
      <div className="min-w-0 pr-20 md:pr-0">
        <label htmlFor={`${ids}-item`} className="mb-1 block text-xs text-muted-foreground md:sr-only">
          Line {n} item
        </label>
        <NativeSelect
          id={`${ids}-item`}
          ref={itemRef}
          value={itemValue}
          onChange={(e) => pick(e.target.value)}
          className={cn("h-8", !picked && "text-muted-foreground")}
          aria-label={`Line ${n} item`}
        >
          <option value="" disabled>
            {catalog.length ? "Choose from the rate card…" : "No items of this type yet"}
          </option>
          {missing && <option value={item.catalogItemId!}>{item.name || "Removed item"} (not in rate card)</option>}
          {itemValue === CUSTOM && <option value={CUSTOM}>{item.name}</option>}
          {groups.length === 1
            ? groups[0][1].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            : groups.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
        </NativeSelect>
        {missing && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="size-3 shrink-0" aria-hidden />
            No longer in the rate card — pick a replacement.
          </p>
        )}
      </div>

      {/* Variant */}
      <div className="min-w-0">
        <label htmlFor={`${ids}-variant`} className="mb-1 block text-xs text-muted-foreground md:sr-only">
          Line {n} {item.itemType === "accessory" ? "brand" : "variant"}
        </label>
        <NativeSelect
          id={`${ids}-variant`}
          value={item.variantLabel}
          disabled={!source}
          onChange={(e) => {
            const v = source?.variants.find((x) => x.label === e.target.value);
            if (v) onChange({ variantLabel: v.label, rate: v.rate });
          }}
          className="h-8"
        >
          {!source && <option value={item.variantLabel}>{item.variantLabel || "—"}</option>}
          {source && !currentVariant && <option value={item.variantLabel}>{item.variantLabel || "—"} (old)</option>}
          {source?.variants.map((v) => (
            <option key={v.label} value={v.label}>
              {v.label} · {formatINR(v.rate)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Size or quantity */}
      <div className="min-w-0">
        {basis === "area" ? (
          <>
            <span className="mb-1 block text-xs text-muted-foreground md:sr-only">Line {n} size (mm)</span>
            <div className="flex items-center gap-1">
              <NumberInput
                value={item.lengthMm}
                onValueChange={(v) => onChange({ lengthMm: v })}
                onKeyDown={enter}
                placeholder="L"
                aria-label={`Line ${n} length in mm`}
                className="h-8 min-w-0 tabular-nums"
                {...aria("lengthMm")}
              />
              <span className="text-xs text-muted-foreground" aria-hidden>
                ×
              </span>
              <NumberInput
                value={item.heightMm}
                onValueChange={(v) => onChange({ heightMm: v })}
                onKeyDown={enter}
                placeholder="H"
                aria-label={`Line ${n} height in mm`}
                className="h-8 min-w-0 tabular-nums"
                {...aria("heightMm")}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              mm · {areaSqft(item.lengthMm, item.heightMm).toFixed(2)} sq.ft
            </p>
            {fieldError("lengthMm") ?? fieldError("heightMm")}
          </>
        ) : (
          <>
            <label htmlFor={`${ids}-qty`} className="mb-1 block text-xs text-muted-foreground md:sr-only">
              Line {n} quantity{item.uom ? ` (${item.uom})` : ""}
            </label>
            <div className="flex items-center gap-1.5">
              <NumberInput
                id={`${ids}-qty`}
                value={item.qty}
                onValueChange={(v) => onChange({ qty: v })}
                onKeyDown={enter}
                placeholder="Qty"
                className="h-8 min-w-0 tabular-nums"
                {...aria("qty")}
              />
              <span className="shrink-0 text-xs text-muted-foreground">{basis === "uom" ? item.uom || "units" : "nos"}</span>
            </div>
            {fieldError("qty")}
          </>
        )}
      </div>

      {/* Rate + amount */}
      <div className="flex items-baseline justify-between gap-2 md:contents">
        <div className="min-w-0 text-sm md:pt-1.5 md:text-right">
          <span className="text-xs text-muted-foreground md:hidden">Rate </span>
          <span className="tabular-nums">
            {formatINR(item.rate)}
            <span className="text-xs text-muted-foreground">{rateSuffix(item)}</span>
          </span>
          {staleRate !== null && (
            <button
              type="button"
              onClick={() => onChange({ rate: staleRate })}
              className="block text-xs font-medium text-ink underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:ml-auto"
            >
              Rate card: {formatINR(staleRate)} — update
            </button>
          )}
        </div>
        <div className="text-right md:pt-1.5">
          <span className="text-xs text-muted-foreground md:hidden">Amount </span>
          <span className="font-semibold text-ink tabular-nums">{formatINR(item.amount)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-0 flex md:static md:justify-end md:pt-0.5">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label={`Duplicate line ${n}`} title="Duplicate line">
          <Copy aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove line ${n}`} title="Remove line">
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
