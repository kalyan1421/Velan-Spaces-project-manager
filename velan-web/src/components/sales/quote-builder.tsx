"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudOff,
  Copy,
  Download,
  FileDown,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmDeleteDialog } from "@/components/project/budget/confirm-delete-dialog";
import { NativeSelect } from "@/components/project/form/native-select";
import { useUnsavedChangesWarning } from "@/components/project/form/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CATALOG_ITEM_TYPES,
  CATALOG_ITEM_TYPE_PLURALS,
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  type CatalogItem,
  type CatalogItemType,
  type Lead,
  type QuotationSettings,
  type Quote,
  type QuoteStatus,
  type QuoteTemplate,
} from "@/lib/api/sales-types";
import type { Role } from "@/lib/api/types";
import { formatDate, formatINR } from "@/lib/format";
import { quoteBreakdown } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { downloadClientPdf, downloadServerPdf } from "./pdf-download";
import {
  addLine,
  addSection,
  draftFingerprint,
  draftFromQuote,
  draftToInput,
  duplicateLine,
  insertSections,
  isEmptyLine,
  lineCount,
  moveSection,
  previewQuote,
  recomputeDraft,
  removeLine,
  removeSection,
  updateLine,
  updateSection,
  type QuoteDraft,
} from "./quote-draft";
import { QUOTE_LIMITS, issueCount, quoteDraftIssues } from "./quote-form-schema";
import { QuoteSectionCard } from "./quote-section-card";
import { QuoteTotalsCard } from "./quote-totals-card";
import { QuoteStatusBadge } from "./status-badges";
import { useDeleteQuote, useDuplicateQuote, useSaveQuote } from "./use-sales";

/** Drafts autosave this long after the last edit (spec R-D10: ≤ 10 s). */
const AUTOSAVE_MS = 5_000;

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * Quote builder. Keeps one editable draft; every edit recomputes line amounts
 * and the totals live (same maths as the API). Save = PATCH; drafts autosave.
 * PDF: "Download PDF" renders the live draft in the browser; "Server PDF"
 * saves first, then downloads the API's PDF of the saved quote.
 */
export function QuoteBuilder({
  quote: initialQuote,
  catalog,
  templates,
  settings,
  lead,
  me,
}: {
  quote: Quote;
  catalog: CatalogItem[];
  templates: QuoteTemplate[];
  settings: QuotationSettings;
  lead: Lead | null;
  me: { id: string; role: Role };
}) {
  const router = useRouter();
  const ids = useId();
  const round = settings.roundAmounts;
  const isHead = me.role === "head";

  const [saved, setSaved] = useState(initialQuote);
  const [draft, setDraft] = useState<QuoteDraft>(() => recomputeDraft(draftFromQuote(initialQuote), round));
  const [baseline, setBaseline] = useState(() => draftFingerprint(draftFromQuote(initialQuote), round));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReturn, setDeleteReturn] = useState<HTMLElement | null>(null);
  const [pdfBusy, setPdfBusy] = useState<null | "client" | "server">(null);

  const { mutateAsync: saveQuote } = useSaveQuote(initialQuote.id);
  const duplicate = useDuplicateQuote();
  const remove = useDeleteQuote();

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const fingerprint = useMemo(() => draftFingerprint(draft, round), [draft, round]);
  const dirty = fingerprint !== baseline;
  const breakdown = useMemo(
    () =>
      quoteBreakdown({
        sections: draft.sections,
        discountType: draft.discountType,
        discountValue: draft.discountValue,
        gstPercent: draft.gstPercent,
        round,
      }),
    [draft.sections, draft.discountType, draft.discountValue, draft.gstPercent, round],
  );
  const issues = useMemo(() => quoteDraftIssues(draft, breakdown.subtotal), [draft, breakdown.subtotal]);
  const problems = issueCount(issues);
  const valid = problems === 0;
  useUnsavedChangesWarning(dirty);

  // ------------------------------------------------------------------ save

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(
    async ({ silent = false, override }: { silent?: boolean; override?: QuoteDraft } = {}): Promise<boolean> => {
      // Let a running save finish first so saves never overlap.
      if (inFlight.current) await inFlight.current;
      const current = override ?? draftRef.current;
      const b = quoteBreakdown({
        sections: current.sections,
        discountType: current.discountType,
        discountValue: current.discountValue,
        gstPercent: current.gstPercent,
        round,
      });
      if (issueCount(quoteDraftIssues(current, b.subtotal)) > 0) {
        if (!silent) toast.error("Fix the highlighted fields, then save.");
        return false;
      }
      const body = draftToInput(current, { round });
      const sent = JSON.stringify(body);
      const run = (async () => {
        setSaveState({ kind: "saving" });
        try {
          const result = await saveQuote(body);
          if (result.id) setSaved(result);
          setBaseline(sent);
          setSaveState({ kind: "saved" });
          if (!silent) toast.success("Quote saved");
          return true;
        } catch (e) {
          const message = errorMessage(e, "We couldn't save the quote.");
          setSaveState({ kind: "error", message });
          if (!silent) toast.error(message);
          return false;
        }
      })();
      inFlight.current = run;
      try {
        return await run;
      } finally {
        if (inFlight.current === run) inFlight.current = null;
      }
    },
    [round, saveQuote],
  );

  // Drafts autosave a few seconds after the last edit.
  useEffect(() => {
    if (!dirty || !valid || draft.status !== "draft") return;
    const timer = setTimeout(() => void save({ silent: true }), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [fingerprint, dirty, valid, draft.status, save]);

  // Ctrl/⌘ + S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // ------------------------------------------------------------------ edits

  const set = <K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const clearFocus = useCallback(() => setFocusKey(null), []);

  const addLineAfter = (sectionKey: string, afterKey?: string) => {
    const section = draft.sections.find((s) => s.key === sectionKey);
    if (!section) return;
    // Enter on a line whose next line is still empty just moves there.
    if (afterKey) {
      const at = section.items.findIndex((i) => i.key === afterKey);
      const next = section.items[at + 1];
      if (next && isEmptyLine(next)) {
        setFocusKey(next.key);
        return;
      }
    }
    const result = addLine(draft, sectionKey, afterKey);
    setDraft(result.draft);
    setFocusKey(result.key);
  };

  const changeStatus = (status: QuoteStatus) => {
    const next = { ...draft, status };
    setDraft(next);
    void save({ override: next }).then((ok) => {
      if (ok) toast.success(`Marked as ${QUOTE_STATUS_LABELS[status].toLowerCase()}`);
    });
  };

  // ------------------------------------------------------------------ actions

  const onClientPdf = async () => {
    setPdfBusy("client");
    try {
      await downloadClientPdf(previewQuote(saved, draft, round), settings);
    } catch (e) {
      console.error(e);
      toast.error("We couldn't create the PDF. Please try again.");
    } finally {
      setPdfBusy(null);
    }
  };

  const onServerPdf = async () => {
    if (dirty && !(await save())) return;
    setPdfBusy("server");
    try {
      await downloadServerPdf({ id: saved.id, quoteNumber: saved.quoteNumber, preparedForName: draft.preparedForName });
    } catch (e) {
      toast.error(errorMessage(e, "We couldn't get the PDF from the server."));
    } finally {
      setPdfBusy(null);
    }
  };

  const onDuplicate = async () => {
    if (dirty && !(await save())) return;
    try {
      const copy = await duplicate.mutateAsync(saved.id);
      toast.success(copy.quoteNumber ? `Copied as ${copy.quoteNumber}` : "Quote duplicated");
      if (copy.id) router.push(`/app/quotes/${copy.id}`);
    } catch (e) {
      toast.error(errorMessage(e, "We couldn't duplicate the quote."));
    }
  };

  const backHref = lead ? `/app/sales/${lead.id}` : "/app/sales";
  const onDelete = async () => {
    try {
      await remove.mutateAsync(saved.id);
      setBaseline(fingerprint); // nothing left to warn about
      setDeleteOpen(false);
      toast.success(`${saved.quoteNumber ?? "Quote"} deleted`);
      router.replace(backHref);
    } catch (e) {
      toast.error(errorMessage(e, "We couldn't delete the quote."));
    }
  };

  // ------------------------------------------------------------------ render

  const number = saved.quoteNumber || "New quote";
  const leadName = lead?.clientName || "Lead";
  const lines = lineCount(draft);
  const err = (k: keyof QuoteDraft) => issues[k];

  const saveButton = (
    <Button size="lg" onClick={() => void save()} disabled={saveState.kind === "saving" || (!dirty && saveState.kind !== "error")}>
      {saveState.kind === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
      Save
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-24 lg:pb-0">
      <SetBreadcrumbs
        items={[
          { label: "Sales", href: "/app/sales" },
          ...(lead ? [{ label: leadName, href: `/app/sales/${lead.id}` }] : []),
          { label: number },
        ]}
      />

      <div className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {lead ? `Back to ${leadName}` : "All leads"}
        </Link>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono tracking-tight">{number}</span>
              <QuoteStatusBadge status={draft.status} />
            </span>
          }
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                {lines} {lines === 1 ? "line" : "lines"} · created {formatDate(saved.createdAt)}
              </span>
              <SaveIndicator state={saveState} dirty={dirty} valid={valid} problems={problems} autosaves={draft.status === "draft"} onRetry={() => void save()} />
            </span>
          }
          actions={
            <>
              <div className="flex items-center gap-1.5">
                <label htmlFor={`${ids}-status`} className="text-sm text-muted-foreground">
                  Status
                </label>
                <NativeSelect
                  id={`${ids}-status`}
                  value={draft.status}
                  onChange={(e) => changeStatus(e.target.value as QuoteStatus)}
                  className="h-9 w-32 bg-card"
                  disabled={saveState.kind === "saving"}
                >
                  {QUOTE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {QUOTE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button variant="outline" size="lg" onClick={() => void onClientPdf()} disabled={pdfBusy !== null}>
                {pdfBusy === "client" ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                {pdfBusy === "client" ? "Preparing…" : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => void onServerPdf()}
                disabled={pdfBusy !== null}
                title="The PDF generated by the server from the saved quote"
              >
                {pdfBusy === "server" ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
                Server PDF
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger id={`${ids}-more`} aria-label="More quote actions" className={cn("grid size-9 place-items-center rounded-lg border border-border bg-background outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted")}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                    <LayoutTemplate aria-hidden />
                    Apply template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onDuplicate()} disabled={duplicate.isPending}>
                    <Copy aria-hidden />
                    Duplicate quote
                  </DropdownMenuItem>
                  {isHead && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setDeleteReturn(document.getElementById(`${ids}-more`));
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 aria-hidden />
                        Delete quote
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <DetailsCard draft={draft} set={set} err={err} />

          {draft.sections.map((section, i) => (
            <QuoteSectionCard
              key={section.key}
              section={section}
              index={i}
              count={draft.sections.length}
              catalog={catalog}
              catalogById={catalogById}
              round={round}
              issues={issues}
              focusKey={focusKey}
              onFocused={clearFocus}
              onRename={(title) => setDraft((d) => updateSection(d, section.key, { title }))}
              onMove={(delta) => setDraft((d) => moveSection(d, section.key, delta))}
              onRemove={() => {
                const before = draft;
                setDraft((d) => removeSection(d, section.key));
                toast(`Removed ${section.title.trim() || "section"}`, {
                  action: { label: "Undo", onClick: () => setDraft(before) },
                });
              }}
              onAddLine={(afterKey) => addLineAfter(section.key, afterKey)}
              onChangeLine={(itemKey, patch) => setDraft((d) => updateLine(d, section.key, itemKey, patch, round))}
              onRemoveLine={(itemKey) => setDraft((d) => removeLine(d, section.key, itemKey))}
              onDuplicateLine={(itemKey) => setDraft((d) => duplicateLine(d, section.key, itemKey))}
            />
          ))}

          <AddSectionCard
            catalog={catalog}
            empty={draft.sections.length === 0}
            hasTemplates={templates.length > 0}
            onAdd={(title, type) => {
              const next = addSection(draft, title, type);
              setDraft(next);
              setFocusKey(next.sections[next.sections.length - 1].items[0]?.key ?? null);
            }}
            onTemplate={() => setTemplateOpen(true)}
          />

          <Card>
            <CardHeader>
              <CardTitle>
                <label htmlFor={`${ids}-ni`}>Not included</label>
              </CardTitle>
              <CardDescription>One item per line. Printed on the PDF under “Not Included Items”.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Textarea
                  id={`${ids}-ni`}
                  value={draft.notIncludedText}
                  onChange={(e) => set("notIncludedText", e.target.value)}
                  rows={4}
                  placeholder={"Electrical work\nCivil work\nPainting"}
                  aria-invalid={err("notIncludedText") ? true : undefined}
                  aria-describedby={err("notIncludedText") ? `${ids}-ni-error` : undefined}
                />
                {err("notIncludedText") && (
                  <p id={`${ids}-ni-error`} className="mt-1 text-xs font-medium text-destructive">
                    {err("notIncludedText")}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-medium text-ink">Terms &amp; conditions</p>
                {settings.defaultTerms.trim() ? (
                  <p className="mt-1 line-clamp-4 whitespace-pre-line text-muted-foreground">{settings.defaultTerms}</p>
                ) : (
                  <p className="mt-1 text-muted-foreground">No terms set yet.</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Terms come from{" "}
                  {isHead ? (
                    <Link href="/app/settings/quotation" className="font-medium text-ink underline underline-offset-4">
                      Quotation settings
                    </Link>
                  ) : (
                    "Quotation settings"
                  )}{" "}
                  and print on every quote.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20" aria-label="Totals">
          <QuoteTotalsCard
            breakdown={breakdown}
            discountType={draft.discountType}
            discountValue={draft.discountValue}
            gstPercent={draft.gstPercent}
            discountError={err("discountValue")}
            gstError={err("gstPercent")}
            onDiscountType={(t) => set("discountType", t)}
            onDiscountValue={(v) => set("discountValue", v)}
            onGst={(v) => set("gstPercent", v)}
            footer={
              <div className="flex flex-col gap-2 border-t pt-3">
                <div className="hidden lg:block">{saveButton}</div>
                {!dirty && Math.abs(saved.grandTotal - breakdown.grandTotal) >= 0.01 && saveState.kind !== "saving" && (
                  <p className="text-xs text-muted-foreground">
                    Last saved total: {formatINR(saved.grandTotal)}. Save to update it.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Totals are recalculated by the server on save{round ? "; the grand total is rounded to the rupee" : ""}.
                </p>
              </div>
            }
          />
        </aside>
      </div>

      {/* Phones: totals + save always in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Grand total</p>
          <p className="font-heading text-lg font-semibold text-ink tabular-nums">{formatINR(Math.max(0, breakdown.payable))}</p>
        </div>
        {saveButton}
      </div>

      <ApplyTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        templates={templates}
        catalog={catalog}
        round={round}
        hasSections={draft.sections.length > 0}
        onApply={(sections, mode) => {
          setDraft((d) => insertSections(d, sections, mode));
          toast.success(`Added ${sections.length} ${sections.length === 1 ? "room" : "rooms"} from the template`);
        }}
      />
      {isHead && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          title={`Delete ${number}?`}
          description="The quote and its line items are removed for everyone. This can't be undone."
          pending={remove.isPending}
          onConfirm={() => void onDelete()}
          onCancel={() => setDeleteOpen(false)}
          returnFocus={deleteReturn}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function SaveIndicator({
  state,
  dirty,
  valid,
  problems,
  autosaves,
  onRetry,
}: {
  state: SaveState;
  dirty: boolean;
  valid: boolean;
  problems: number;
  autosaves: boolean;
  onRetry: () => void;
}) {
  const base = "inline-flex items-center gap-1 text-xs";
  if (state.kind === "saving") {
    return (
      <span className={base} role="status">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (dirty && !valid) {
    return (
      <span className={cn(base, "text-warning")} role="status">
        <AlertTriangle className="size-3" aria-hidden />
        {problems === 1 ? "1 field needs attention" : `${problems} fields need attention`} before saving
      </span>
    );
  }
  if (state.kind === "error" && dirty) {
    return (
      <span className={cn(base, "text-destructive")} role="status">
        <CloudOff className="size-3" aria-hidden />
        Not saved.{" "}
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Retry
        </button>
      </span>
    );
  }
  if (dirty) {
    return (
      <span className={base} role="status">
        <span aria-hidden className="size-1.5 rounded-full bg-gold" />
        Unsaved changes{autosaves ? " · autosaving" : ""}
      </span>
    );
  }
  return (
    <span className={cn(base, "text-success")} role="status">
      <Check className="size-3" aria-hidden />
      All changes saved
    </span>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function DetailsCard({
  draft,
  set,
  err,
}: {
  draft: QuoteDraft;
  set: <K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) => void;
  err: (key: keyof QuoteDraft) => string | undefined;
}) {
  const ids = useId();
  const text = (key: keyof QuoteDraft & string, label: string, opts: { type?: string; max?: number; placeholder?: string; className?: string; autoComplete?: string } = {}) => {
    const id = `${ids}-${key}`;
    const error = err(key);
    return (
      <Field id={id} label={label} error={error} className={opts.className}>
        <Input
          id={id}
          type={opts.type ?? "text"}
          value={String(draft[key] ?? "")}
          onChange={(e) => set(key, e.target.value as QuoteDraft[typeof key])}
          maxLength={opts.max}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete ?? "off"}
          className="h-9"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </Field>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client &amp; quote details</CardTitle>
        <CardDescription>Printed in the “Prepared for” block and the details table of the PDF.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("preparedForName", "Prepared for", { max: QUOTE_LIMITS.name })}
          {text("preparedForPhone", "Phone", { type: "tel", max: QUOTE_LIMITS.phone })}
          {text("preparedForEmail", "Email", { type: "email", max: QUOTE_LIMITS.email })}
          {text("siteLocation", "Site location", { max: QUOTE_LIMITS.siteLocation })}
          {text("preparedForAddress", "Address", { max: QUOTE_LIMITS.address, className: "sm:col-span-2" })}
        </div>
        <div className="grid gap-4 border-t pt-5 sm:grid-cols-2 xl:grid-cols-3">
          {text("quoteDate", "Quote date", { type: "date" })}
          {text("validUntil", "Valid until", { type: "date" })}
          {text("enquiryDate", "Enquiry date", { type: "date" })}
          {text("enquiryNo", "Enquiry no.", { max: QUOTE_LIMITS.enquiryNo })}
          {text("projectType", "Project type", { max: QUOTE_LIMITS.projectType, placeholder: "Residential" })}
          {text("handledBy", "Handled by", { max: QUOTE_LIMITS.person })}
          {text("designedBy", "Designed by", { max: QUOTE_LIMITS.person })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Adds a room/section: free name + table type, or one-click from the rate card's groups. */
function AddSectionCard({
  catalog,
  empty,
  hasTemplates,
  onAdd,
  onTemplate,
}: {
  catalog: CatalogItem[];
  empty: boolean;
  hasTemplates: boolean;
  onAdd: (title: string, type: CatalogItemType) => void;
  onTemplate: () => void;
}) {
  const ids = useId();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CatalogItemType>("component");
  const [error, setError] = useState<string | null>(null);

  // Rate-card groups ("Modular Kitchen") with their most common item type.
  const suggestions = useMemo(() => {
    const byGroup = new Map<string, Record<CatalogItemType, number>>();
    for (const c of catalog) {
      const g = c.defaultSection?.trim();
      if (!g) continue;
      const counts = byGroup.get(g) ?? { component: 0, accessory: 0, service: 0 };
      counts[c.itemType] += 1;
      byGroup.set(g, counts);
    }
    return [...byGroup.entries()]
      .map(([name, counts]) => ({
        name,
        type: CATALOG_ITEM_TYPES.reduce((best, t) => (counts[t] > counts[best] ? t : best), "component" as CatalogItemType),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [catalog]);

  return (
    <Card className={cn(empty && "ring-2 ring-gold/60")}>
      <CardHeader>
        <CardTitle>{empty ? "Add the first room" : "Add a room or section"}</CardTitle>
        <CardDescription>
          The table type decides the columns: components are priced by size (L × H), accessories by quantity, services per
          unit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            const name = title.trim();
            if (!name) {
              setError("Give the room or section a name.");
              return;
            }
            onAdd(name, type);
            setTitle("");
            setError(null);
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${ids}-title`} className="sr-only">
              Room or section name
            </label>
            <Input
              id={`${ids}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Bedroom Wardrobe"
              maxLength={QUOTE_LIMITS.sectionTitle}
              className="h-9"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids}-title-error` : undefined}
            />
            {error && (
              <p id={`${ids}-title-error`} className="mt-1 text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
          <label htmlFor={`${ids}-type`} className="sr-only">
            Table type
          </label>
          <NativeSelect
            id={`${ids}-type`}
            value={type}
            onChange={(e) => setType(e.target.value as CatalogItemType)}
            className="h-9 sm:w-48"
          >
            {CATALOG_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {CATALOG_ITEM_TYPE_PLURALS[t]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="lg">
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        </form>
        {(suggestions.length > 0 || hasTemplates) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {suggestions.length > 0 && <span className="text-xs text-muted-foreground">Quick add:</span>}
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => onAdd(s.name, s.type)}
                className="h-7 rounded-full bg-muted px-3 text-xs font-medium text-ink outline-none transition-colors hover:bg-sun/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                + {s.name}
              </button>
            ))}
            {hasTemplates && (
              <Button type="button" variant="link" size="sm" onClick={onTemplate} className="h-7 px-1">
                <LayoutTemplate data-icon="inline-start" aria-hidden />
                Apply a template
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
