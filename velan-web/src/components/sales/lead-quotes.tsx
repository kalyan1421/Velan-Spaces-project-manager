"use client";

import { Copy, Download, FileText, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/project/budget/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Quote } from "@/lib/api/sales-types";
import { formatDate, formatINR } from "@/lib/format";
import { downloadServerPdf } from "./pdf-download";
import { QuoteStatusBadge } from "./status-badges";
import { useDeleteQuote, useDuplicateQuote } from "./use-sales";

const quoteLabel = (q: Pick<Quote, "quoteNumber">) => q.quoteNumber || "Quote (no number yet)";
const lineTotal = (q: Quote) => q.sections.reduce((n, s) => n + s.items.length, 0);

/** The lead's quotations: open, duplicate, server PDF, delete (head only, as the API enforces). */
export function LeadQuotes({
  quotes,
  canDelete,
  onNewQuote,
}: {
  quotes: Quote[];
  canDelete: boolean;
  onNewQuote: () => void;
}) {
  const router = useRouter();
  const duplicate = useDuplicateQuote();
  const remove = useDeleteQuote();
  const [pending, setPending] = useState<Quote | null>(null);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...quotes].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const onDuplicate = async (q: Quote) => {
    setBusyId(q.id);
    try {
      const copy = await duplicate.mutateAsync(q.id);
      toast.success(copy.quoteNumber ? `Copied as ${copy.quoteNumber}` : "Quote duplicated", {
        action: copy.id ? { label: "Open", onClick: () => router.push(`/app/quotes/${copy.id}`) } : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't duplicate the quote.");
    } finally {
      setBusyId(null);
    }
  };

  const onPdf = async (q: Quote) => {
    setBusyId(q.id);
    try {
      await downloadServerPdf(q);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't create the PDF.");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async () => {
    if (!pending) return;
    try {
      await remove.mutateAsync(pending.id);
      toast.success(`${quoteLabel(pending)} deleted`);
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't delete the quote.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotations</CardTitle>
        <CardAction>
          <Button size="sm" onClick={onNewQuote}>
            <Plus data-icon="inline-start" aria-hidden />
            New quote
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <FileText className="size-5 text-muted-foreground" aria-hidden />
            <p className="font-medium text-ink">No quotes yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Build a proposal from the rate card or a template, then download the PDF to share.
            </p>
          </div>
        ) : (
          <ul className="-my-2 divide-y">
            {sorted.map((q) => (
              <li key={q.id} className="relative flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/app/quotes/${q.id}`}
                      className="truncate font-medium text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                    >
                      {quoteLabel(q)}
                    </Link>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(q.quoteDate || q.createdAt)} · {lineTotal(q)} {lineTotal(q) === 1 ? "line" : "lines"}
                  </p>
                </div>
                <span className="shrink-0 text-right font-medium tabular-nums text-ink">{formatINR(q.grandTotal)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    id={`quote-actions-${q.id}`}
                    aria-label={`Actions for ${quoteLabel(q)}`}
                    disabled={busyId === q.id}
                    className="relative z-10 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
                  >
                    {busyId === q.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => router.push(`/app/quotes/${q.id}`)}>
                        <Pencil aria-hidden />
                        Open builder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void onDuplicate(q)}>
                        <Copy aria-hidden />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void onPdf(q)}>
                        <Download aria-hidden />
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setReturnFocus(document.getElementById(`quote-actions-${q.id}`));
                              setPending(q);
                            }}
                          >
                            <Trash2 aria-hidden />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDeleteDialog
        open={pending !== null}
        title={`Delete ${pending ? quoteLabel(pending) : "quote"}?`}
        description="The quote and its line items are removed for everyone. This can't be undone."
        pending={remove.isPending}
        onConfirm={() => void onDelete()}
        onCancel={() => setPending(null)}
        returnFocus={returnFocus}
      />
    </Card>
  );
}
