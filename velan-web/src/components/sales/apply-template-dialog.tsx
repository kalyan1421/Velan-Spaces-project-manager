"use client";

import { AlertTriangle, LayoutTemplate } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CatalogItem, QuoteSection, QuoteTemplate } from "@/lib/api/sales-types";
import { applyTemplate, templateLineCount, unresolvedTemplateLines } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";

/** Adds a template's rooms to the quote (or replaces them), priced from the current rate card. */
export function ApplyTemplateDialog({
  open,
  onOpenChange,
  templates,
  catalog,
  round,
  hasSections,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: QuoteTemplate[];
  catalog: CatalogItem[];
  round: boolean;
  hasSections: boolean;
  onApply: (sections: QuoteSection[], mode: "append" | "replace") => void;
}) {
  const ids = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const chosen = templates.find((t) => t.id === choice) ?? null;
  const missing = chosen ? unresolvedTemplateLines(chosen, catalog) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply a template</DialogTitle>
          <DialogDescription>Rates come from the current rate card. You can edit every line afterwards.</DialogDescription>
        </DialogHeader>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No templates yet. The administrator can create them under Sales → Templates.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Template</legend>
            {templates.map((t) => {
              const lines = templateLineCount(t);
              const on = choice === t.id;
              return (
                <label
                  key={t.id}
                  htmlFor={`${ids}-${t.id}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    on ? "bg-sun/20 ring-gold" : "ring-border hover:bg-muted/50",
                  )}
                >
                  <input
                    id={`${ids}-${t.id}`}
                    type="radio"
                    name={`${ids}-template`}
                    checked={on}
                    onChange={() => setChoice(t.id)}
                    className="sr-only"
                  />
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", on ? "bg-gold text-ink" : "bg-muted text-muted-foreground")}>
                    <LayoutTemplate className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{t.name || "Untitled template"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.sections.map((s) => s.title).filter(Boolean).join(", ") || "No sections"} · {lines}{" "}
                      {lines === 1 ? "line" : "lines"}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {hasSections && chosen && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium text-ink">This quote already has rooms</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  ["append", "Add to them"],
                  ["replace", "Replace them"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center justify-center rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-ink has-checked:bg-card has-checked:text-ink has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input
                    type="radio"
                    name={`${ids}-mode`}
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {missing.length > 0 && (
          <p className="flex gap-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {missing.length === 1 ? "1 line is" : `${missing.length} lines are`} no longer in the rate card and will be
              added at ₹0 for you to replace.
            </span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onApply(applyTemplate(chosen, catalog, { round }), hasSections ? mode : "append");
              onOpenChange(false);
              setChoice(null);
            }}
          >
            Apply template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
