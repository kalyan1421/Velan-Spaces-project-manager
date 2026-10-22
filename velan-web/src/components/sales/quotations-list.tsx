"use client";

import { FileText, Plus, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StateMessage } from "@/components/app-shell/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salesApi, salesKeys } from "@/lib/api/sales";
import type { Quote } from "@/lib/api/sales-types";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NewQuoteDialog } from "./new-quote-dialog";
import {
  QUOTE_STATUS_TABS,
  countQuotationsByStatus,
  filterQuotations,
  quotationPerson,
  type QuoteStatusFilter,
} from "./quotation-list-model";
import { QuoteStatusBadge } from "./status-badges";

/** All quotations (with or without a lead): search, status tabs, and a New quotation button for anyone. */
export function QuotationsList({ initialQuotes, handledBy }: { initialQuotes: Quote[]; handledBy: string }) {
  const [initialAt] = useState(() => Date.now());
  const query = useQuery({
    queryKey: salesKeys.quotes(),
    queryFn: ({ signal }) => salesApi.listQuotes(undefined, { signal }),
    initialData: initialQuotes,
    initialDataUpdatedAt: initialAt,
  });
  const quotes = query.data;
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const [status, setStatus] = useState<QuoteStatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => countQuotationsByStatus(quotes), [quotes]);
  const shown = useMemo(() => filterQuotations(quotes, deferred, status), [quotes, deferred, status]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quotations"
        description={`${quotes.length} ${quotes.length === 1 ? "quotation" : "quotations"} · for anyone, with or without a lead`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            New quotation
          </Button>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search number, name, phone, location…"
          aria-label="Search quotations"
          className="pl-9"
        />
      </div>

      <div role="tablist" aria-label="Quotation status" className="flex flex-wrap gap-2">
        {QUOTE_STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={status === t.value}
            onClick={() => setStatus(t.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              status === t.value ? "bg-ink text-white ring-ink" : "bg-card text-muted-foreground ring-border hover:bg-muted/50",
            )}
          >
            {t.label} <span className="tabular-nums opacity-70">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      {quotes.length === 0 ? (
        <StateMessage
          icon={FileText}
          title="No quotations yet"
          description="Create one for any person or company. Pick items from the rate card and download the PDF."
          action={<Button onClick={() => setCreateOpen(true)}>New quotation</Button>}
        />
      ) : shown.length === 0 ? (
        <StateMessage icon={SearchX} title="No quotations match" description="Try a different search or status." />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((q) => (
            <li key={q.id}>
              <Link
                href={`/app/quotes/${q.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate font-medium text-ink">{quotationPerson(q)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{q.quoteNumber || "No number yet"}</span>
                    {q.preparedForPhone ? ` · ${q.preparedForPhone}` : ""}
                    {q.siteLocation ? ` · ${q.siteLocation}` : ""}
                    {q.leadId ? "" : " · no lead"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(q.quoteDate || q.createdAt)}</span>
                <QuoteStatusBadge status={String(q.status)} />
                <span className="w-28 text-right text-sm font-semibold tabular-nums text-ink">{formatINR(q.grandTotal)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewQuoteDialog open={createOpen} onOpenChange={setCreateOpen} lead={null} handledBy={handledBy} />
    </div>
  );
}
