"use client";

import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CATALOG_ITEM_TYPE_PLURALS, type CatalogItem, type QuoteItem } from "@/lib/api/sales-types";
import { formatINR } from "@/lib/format";
import { sectionSubtotal } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";
import type { DraftSection } from "./quote-draft";
import type { QuoteIssues } from "./quote-form-schema";
import { LINE_GRID, QuoteLineRow } from "./quote-line-row";

const SIZE_HEADER = { component: "Size (L × H)", accessory: "Qty", service: "Qty" } as const;
const VARIANT_HEADER = { component: "Variant", accessory: "Brand", service: "Variant" } as const;

/** One room / section: editable title, line table, subtotal and section actions. */
export function QuoteSectionCard({
  section,
  index,
  count,
  catalog,
  catalogById,
  round,
  issues,
  focusKey,
  onFocused,
  onRename,
  onMove,
  onRemove,
  onAddLine,
  onChangeLine,
  onRemoveLine,
  onDuplicateLine,
}: {
  section: DraftSection;
  index: number;
  count: number;
  catalog: CatalogItem[];
  catalogById: Map<string, CatalogItem>;
  round: boolean;
  issues: QuoteIssues;
  /** Line to focus after it was added. */
  focusKey: string | null;
  onFocused: () => void;
  onRename: (title: string) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onAddLine: (afterKey?: string) => void;
  onChangeLine: (itemKey: string, patch: Partial<QuoteItem>) => void;
  onRemoveLine: (itemKey: string) => void;
  onDuplicateLine: (itemKey: string) => void;
}) {
  const ids = useId();
  const ofType = useMemo(() => catalog.filter((c) => c.itemType === section.type), [catalog, section.type]);
  const subtotal = sectionSubtotal(section.items);
  const titleIssue = issues[`section:${section.key}`];
  const label = section.title.trim() || `Section ${index + 1}`;

  return (
    <section aria-labelledby={`${ids}-title`} className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 id={`${ids}-title`} className="sr-only">
            {label}
          </h3>
          <label htmlFor={`${ids}-name`} className="sr-only">
            Room or section name
          </label>
          <Input
            id={`${ids}-name`}
            value={section.title}
            onChange={(e) => onRename(e.target.value)}
            placeholder="Room / section name, e.g. Modular Kitchen"
            className="h-9 border-transparent bg-transparent px-1.5 font-heading text-base font-semibold text-ink hover:border-input focus-visible:border-ring"
            aria-invalid={titleIssue ? true : undefined}
            aria-describedby={titleIssue ? `${ids}-name-error` : undefined}
          />
          {titleIssue && (
            <p id={`${ids}-name-error`} className="mt-1 px-1.5 text-xs font-medium text-destructive">
              {titleIssue}
            </p>
          )}
          <p className="px-1.5 text-xs text-muted-foreground">{CATALOG_ITEM_TYPE_PLURALS[section.type]}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-right">
            <span className="block text-xs text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-ink tabular-nums">{formatINR(subtotal)}</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${label}`}
              className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled={index === 0} onClick={() => onMove(-1)}>
                <ArrowUp aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === count - 1} onClick={() => onMove(1)}>
                <ArrowDown aria-hidden />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                <Trash2 aria-hidden />
                Remove section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="px-4">
        <div
          aria-hidden
          className={cn("hidden border-b py-2 text-xs font-medium text-muted-foreground md:grid", LINE_GRID)}
        >
          <span className="text-right">#</span>
          <span>Item</span>
          <span>{VARIANT_HEADER[section.type]}</span>
          <span>{SIZE_HEADER[section.type]}</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        {section.items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No lines yet.</p>
        ) : (
          <ul aria-label={`${label} lines`}>
            {section.items.map((item, i) => (
              <QuoteLineRow
                key={item.key}
                item={item}
                index={i}
                catalog={ofType}
                catalogById={catalogById}
                round={round}
                issues={issues}
                autoFocus={focusKey === item.key}
                onFocused={onFocused}
                onChange={(patch) => onChangeLine(item.key, patch)}
                onRemove={() => onRemoveLine(item.key)}
                onDuplicate={() => onDuplicateLine(item.key)}
                onEnter={() => onAddLine(item.key)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => onAddLine()}>
          <Plus data-icon="inline-start" aria-hidden />
          Add line
        </Button>
        {ofType.length === 0 ? (
          <span className="text-xs text-warning">
            The rate card has no active {CATALOG_ITEM_TYPE_PLURALS[section.type].toLowerCase()} yet.
          </span>
        ) : (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Tip: press Enter in a size or quantity to add the next line.
          </span>
        )}
      </div>
    </section>
  );
}
