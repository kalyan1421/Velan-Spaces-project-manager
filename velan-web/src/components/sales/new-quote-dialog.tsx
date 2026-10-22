"use client";

import { AlertTriangle, FileText, LayoutTemplate, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead } from "@/lib/api/sales-types";
import { applyTemplate, templateLineCount, unresolvedTemplateLines } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";
import { newQuoteInput } from "./quote-draft";
import { useCatalog, useCreateQuote, useQuotationSettings, useTemplates } from "./use-sales";

const BLANK = "__blank__";

/**
 * Starts a quote for a lead: blank or from a template (priced from the current
 * rate card). The quote is created right away (the server assigns its number)
 * and the builder opens.
 */
export function NewQuoteDialog({
  open,
  onOpenChange,
  lead,
  handledBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  handledBy: string;
}) {
  const router = useRouter();
  const ids = useId();
  const templates = useTemplates(open);
  const catalog = useCatalog(open);
  const settings = useQuotationSettings(open);
  const create = useCreateQuote();
  const [choice, setChoice] = useState<string>(BLANK);
  const [error, setError] = useState<string | null>(null);

  const loading = templates.isPending || catalog.isPending || settings.isPending;
  const loadFailed = templates.isError || catalog.isError || settings.isError;
  const list = templates.data ?? [];
  const chosen = list.find((t) => t.id === choice) ?? null;
  const missing = chosen && catalog.data ? unresolvedTemplateLines(chosen, catalog.data) : [];
  const busy = create.isPending;

  const start = async () => {
    setError(null);
    if (!settings.data || !catalog.data) return;
    const round = settings.data.roundAmounts;
    const sections = chosen ? applyTemplate(chosen, catalog.data, { round }) : [];
    try {
      const quote = await create.mutateAsync(newQuoteInput({ lead, settings: settings.data, sections, handledBy }));
      if (!quote.id) throw new Error("The quote was created but the server didn't return it. Refresh the page.");
      toast.success(quote.quoteNumber ? `Quote ${quote.quoteNumber} created` : "Quote created");
      onOpenChange(false);
      router.push(`/app/quotes/${quote.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't create the quote. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New quote</DialogTitle>
          <DialogDescription>
            Start blank or from a template. Client details, GST and validity are filled in from the lead and your
            quotation settings.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading templates">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : loadFailed ? (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t load the rate card or templates.{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-4"
                onClick={() => {
                  void templates.refetch();
                  void catalog.refetch();
                  void settings.refetch();
                }}
              >
                Try again
              </button>
            </AlertDescription>
          </Alert>
        ) : (
          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="sr-only">Start from</legend>
            <Option
              id={`${ids}-blank`}
              name={`${ids}-start`}
              checked={choice === BLANK}
              onSelect={() => setChoice(BLANK)}
              icon={FileText}
              title="Blank quote"
              detail="Add rooms and items from the rate card."
            />
            {list.map((t) => {
              const lines = templateLineCount(t);
              return (
                <Option
                  key={t.id}
                  id={`${ids}-${t.id}`}
                  name={`${ids}-start`}
                  checked={choice === t.id}
                  onSelect={() => setChoice(t.id)}
                  icon={LayoutTemplate}
                  title={t.name || "Untitled template"}
                  detail={`${t.sections.length} ${t.sections.length === 1 ? "section" : "sections"} · ${lines} ${lines === 1 ? "line" : "lines"}`}
                />
              );
            })}
            {list.length === 0 && (
              <p className="px-1 text-xs text-muted-foreground">
                No templates yet. The administrator can create them under Sales → Templates.
              </p>
            )}
          </fieldset>
        )}

        {missing.length > 0 && (
          <p className="flex gap-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {missing.length === 1 ? "1 line is" : `${missing.length} lines are`} no longer in the rate card (
              {missing.slice(0, 3).join(", ")}
              {missing.length > 3 ? "…" : ""}) and will be added at ₹0 for you to replace.
            </span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={start} disabled={busy || loading || loadFailed}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {busy ? "Creating…" : "Create quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Option({
  id,
  name,
  checked,
  onSelect,
  icon: Icon,
  title,
  detail,
}: {
  id: string;
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "bg-sun/20 ring-gold" : "ring-border hover:bg-muted/50",
      )}
    >
      <input id={id} type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", checked ? "bg-gold text-ink" : "bg-muted text-muted-foreground")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}
