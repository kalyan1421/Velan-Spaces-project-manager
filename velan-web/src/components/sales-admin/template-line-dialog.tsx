"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { formatINR } from "@/lib/format";
import type { CatalogItem, CatalogItemType, QuoteTemplateLine } from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";
import { PRICING_BASIS, TYPE_LABELS, TYPE_PLURALS, VARIANT_NOUN, areaSqft, groupCatalog, lineAmount, matchesSearch, rateUnit } from "./catalog-model";
import {
  buildLine,
  emptyLineForm,
  lineFormFromLine,
  parseOptionalPositive,
  TEMPLATE_LIMITS,
  type LineFormErrors,
  type LineFormValues,
} from "./template-editor-model";

const sqft = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Pick a rate card item + its default option and size for a template room. */
export function TemplateLineDialog({
  open,
  onOpenChange,
  sectionTitle,
  sectionType,
  catalog,
  line,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionTitle: string;
  sectionType: CatalogItemType;
  catalog: readonly CatalogItem[];
  /** null = add a new line. */
  line: QuoteTemplateLine | null;
  onSave: (line: QuoteTemplateLine) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* The popup unmounts once closed, so each opening starts from `line`. */}
        <LineForm
          sectionTitle={sectionTitle}
          sectionType={sectionType}
          catalog={catalog}
          line={line}
          onCancel={() => onOpenChange(false)}
          onSave={(l) => {
            onSave(l);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function LineForm({
  sectionTitle,
  sectionType,
  catalog,
  line,
  onCancel,
  onSave,
}: {
  sectionTitle: string;
  sectionType: CatalogItemType;
  catalog: readonly CatalogItem[];
  line: QuoteTemplateLine | null;
  onCancel: () => void;
  onSave: (line: QuoteTemplateLine) => void;
}) {
  const id = useId();
  const [values, setValues] = useState<LineFormValues>(() => (line ? lineFormFromLine(line) : emptyLineForm()));
  const [errors, setErrors] = useState<LineFormErrors>({});
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Items of this room's type. Inactive items stay pickable only if the line already uses one.
  const candidates = useMemo(
    () => catalog.filter((i) => i.itemType === sectionType && (i.active || i.id === line?.catalogItemId)),
    [catalog, sectionType, line?.catalogItemId],
  );
  const groups = useMemo(() => groupCatalog(candidates.filter((i) => matchesSearch(i, query))), [candidates, query]);
  const selected = catalog.find((i) => i.id === values.catalogItemId);
  const missing = line !== null && !catalog.some((i) => i.id === line.catalogItemId);
  const basis = PRICING_BASIS[sectionType];
  const noun = VARIANT_NOUN[sectionType];

  const set = (patch: Partial<LineFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as (keyof LineFormValues)[]) delete next[k];
      return next;
    });
  };

  const pick = (item: CatalogItem) => {
    const keepVariant = item.variants.some((v) => v.label === values.variantLabel);
    set({ catalogItemId: item.id, variantLabel: keepVariant ? values.variantLabel : (item.variants[0]?.label ?? "") });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = buildLine(values, selected, sectionType);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(result.line);
  };

  // Live preview of the default amount.
  const rate = selected?.variants.find((v) => v.label === values.variantLabel)?.rate ?? null;
  const preview = (() => {
    if (!selected || rate === null) return null;
    if (basis === "area") {
      const l = parseOptionalPositive(values.lengthMm, TEMPLATE_LIMITS.maxMm, "length");
      const h = parseOptionalPositive(values.heightMm, TEMPLATE_LIMITS.maxMm, "height");
      if (!l.ok || !h.ok || l.value === null || h.value === null) return null;
      const area = areaSqft(l.value, h.value);
      return `${sqft.format(area)} sq.ft × ${formatINR(rate)} = ${formatINR(lineAmount({ type: sectionType, lengthMm: l.value, heightMm: h.value, rate }))}`;
    }
    const q = parseOptionalPositive(values.qty, TEMPLATE_LIMITS.maxQty, "quantity");
    if (!q.ok || q.value === null) return null;
    return `${q.value} × ${formatINR(rate)} = ${formatINR(lineAmount({ type: sectionType, qty: q.value, rate }))}`;
  })();

  const pickerId = `${id}-picker`;

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          {line ? "Edit line" : `Add ${TYPE_LABELS[sectionType].toLowerCase()}`} · {sectionTitle || "Room"}
        </DialogTitle>
        <DialogDescription>
          The rate is looked up from the rate card each time a quote is made from this template.
        </DialogDescription>
      </DialogHeader>

      {missing && (
        <p className="rounded-lg bg-gold/15 px-3 py-2 text-xs text-ink">
          “{line?.name || "This item"}” is no longer on the rate card. Choose a replacement.
        </p>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          There are no active {TYPE_PLURALS[sectionType].toLowerCase()} on the rate card yet.{" "}
          <Link href="/app/rate-card" className="font-medium text-ink underline underline-offset-4">
            Add some on the rate card
          </Link>
          .
        </div>
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">Item</legend>
          <InputGroup className="h-9">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchRef}
              type="search"
              value={query}
              autoComplete="off"
              placeholder={`Search ${TYPE_PLURALS[sectionType].toLowerCase()}…`}
              aria-label="Search the rate card"
              aria-controls={pickerId}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter picks the first match instead of submitting the form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = groups[0]?.sections[0]?.items[0];
                  if (first) pick(first);
                }
              }}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <X aria-hidden />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div
            id={pickerId}
            role="radiogroup"
            aria-label="Rate card items"
            aria-invalid={errors.catalogItemId ? true : undefined}
            aria-describedby={errors.catalogItemId ? `${id}-item-error` : undefined}
            className={cn(
              "max-h-56 overflow-y-auto rounded-lg ring-1 ring-foreground/10",
              errors.catalogItemId && "ring-destructive",
            )}
          >
            {groups.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No items match “{query.trim()}”.</p>
            ) : (
              groups.flatMap((g) =>
                g.sections.map(({ section, items }) => (
                  <div key={section}>
                    <p className="sticky top-0 bg-muted px-3 py-1 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      {section}
                    </p>
                    {items.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 border-b border-foreground/5 px-3 py-2 text-sm last:border-b-0",
                          "hover:bg-muted/60 has-checked:bg-ink/5 has-focus-visible:ring-2 has-focus-visible:ring-ring/50 has-focus-visible:ring-inset",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${id}-item`}
                          value={item.id}
                          checked={values.catalogItemId === item.id}
                          onChange={() => pick(item)}
                          className="sr-only"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{item.name}</span>
                          {item.description && (
                            <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {!item.active && <Badge variant="outline">Inactive</Badge>}
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-4 place-items-center rounded-full ring-1 ring-foreground/25",
                              values.catalogItemId === item.id && "bg-ink ring-ink",
                            )}
                          >
                            {values.catalogItemId === item.id && <span className="size-1.5 rounded-full bg-white" />}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )),
              )
            )}
          </div>
          {errors.catalogItemId && (
            <p id={`${id}-item-error`} className="text-xs font-medium text-destructive">
              {errors.catalogItemId}
            </p>
          )}
        </fieldset>
      )}

      {selected && selected.variants.length > 0 && (
        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink">Default {noun.toLowerCase()}</legend>
          <div className="flex flex-wrap gap-2">
            {selected.variants.map((v) => (
              <label
                key={v.label}
                className={cn(
                  "inline-flex max-w-full cursor-pointer items-baseline gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition-colors",
                  "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  values.variantLabel === v.label ? "bg-ink text-white ring-ink" : "bg-card text-ink ring-foreground/15 hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-variant`}
                  value={v.label}
                  checked={values.variantLabel === v.label}
                  onChange={() => set({ variantLabel: v.label })}
                  className="sr-only"
                />
                <span className="truncate">{v.label || "Unnamed"}</span>
                <span className={cn("shrink-0 tabular-nums", values.variantLabel === v.label ? "text-white/80" : "text-muted-foreground")}>
                  {formatINR(v.rate)}
                  {rateUnit(selected.itemType, selected.uom)}
                </span>
              </label>
            ))}
          </div>
          {errors.variantLabel && <p className="text-xs font-medium text-destructive">{errors.variantLabel}</p>}
        </fieldset>
      )}

      {selected && (
        <div className="flex flex-col gap-2">
          {basis === "area" ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField id={`${id}-length`} label="Default length" error={errors.lengthMm}>
                <InputGroup className="h-9">
                  <InputGroupInput
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 600"
                    value={values.lengthMm}
                    onChange={(e) => set({ lengthMm: e.target.value })}
                    {...fieldAria(`${id}-length`, errors.lengthMm)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>mm</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </FormField>
              <FormField id={`${id}-height`} label="Default height" error={errors.heightMm}>
                <InputGroup className="h-9">
                  <InputGroupInput
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 720"
                    value={values.heightMm}
                    onChange={(e) => set({ heightMm: e.target.value })}
                    {...fieldAria(`${id}-height`, errors.heightMm)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>mm</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </FormField>
            </div>
          ) : (
            <FormField id={`${id}-qty`} label="Default quantity" error={errors.qty}>
              <InputGroup className="h-9 sm:max-w-56">
                <InputGroupInput
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="e.g. 1"
                  value={values.qty}
                  onChange={(e) => set({ qty: e.target.value })}
                  {...fieldAria(`${id}-qty`, errors.qty)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{sectionType === "service" ? selected.uom || "units" : "units"}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </FormField>
          )}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {preview ?? "Leave empty to fill in on each quote."}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={candidates.length === 0}>
          {line ? "Update line" : "Add line"}
        </Button>
      </DialogFooter>
    </form>
  );
}
