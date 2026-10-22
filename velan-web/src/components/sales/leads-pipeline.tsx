"use client";

import { CalendarDays, MapPin, Phone, Plus, RefreshCw, Search, SearchX, Sparkles, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { StateMessage } from "@/components/app-shell/states";
import { NativeSelect } from "@/components/project/form/native-select";
import { useUrlState } from "@/components/project/budget/use-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type Lead,
} from "@/lib/api/sales-types";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LeadFormDialog } from "./lead-form-dialog";
import {
  assigneeLabel,
  countByStatus,
  filterLeads,
  filterLeadsExceptStatus,
  isFreshEnquiry,
  parseLeadFilters,
  sortLeads,
  type LeadAssigneeFilter,
  type LeadFilters,
  type LeadSourceFilter,
  type LeadStatusFilter,
  type Person,
} from "./lead-model";
import { LeadStatusBadge, SourceBadge } from "./status-badges";
import { useLeads } from "./use-sales";

const STATUS_TABS: { value: LeadStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
];

/** Sales landing: the lead pipeline with search, stage tabs and filters (state in the URL). */
export function LeadsPipeline({ initialLeads, people, meId }: { initialLeads: Lead[]; people: Person[]; meId: string }) {
  const router = useRouter();
  const query = useLeads(initialLeads);
  const leads = query.data;
  const [filters, setUrl] = useUrlState(parseLeadFilters);
  const [text, setText] = useState(filters.q);
  const deferredText = useDeferredValue(text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const active: LeadFilters = { ...filters, q: deferredText.trim() };
  const subset = useMemo(
    () => filterLeadsExceptStatus(leads, { ...filters, q: deferredText.trim() }, meId),
    [leads, filters, deferredText, meId],
  );
  const counts = useMemo(() => countByStatus(subset), [subset]);
  const visible = useMemo(
    () => sortLeads(filterLeads(leads, { ...filters, q: deferredText.trim() }, meId)),
    [leads, filters, deferredText, meId],
  );
  const fresh = useMemo(() => leads.filter(isFreshEnquiry).length, [leads]);

  const set = useCallback((updates: Partial<Record<keyof LeadFilters, string>>) => {
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(updates)) out[k] = !v || v === "all" ? null : v;
    setUrl(out);
  }, [setUrl]);

  const filtered = active.q !== "" || active.status !== "all" || active.source !== "all" || active.assignee !== "all";
  const clear = () => {
    setText("");
    setUrl({ q: null, status: null, source: null, assignee: null });
  };

  const newLeadButton = (
    <Button size="lg" onClick={() => setCreateOpen(true)}>
      <Plus data-icon="inline-start" aria-hidden />
      New lead
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Sales"
        description={
          leads.length === 0 ? (
            "Leads, follow-ups and quotations."
          ) : (
            <>
              {leads.length} {leads.length === 1 ? "lead" : "leads"}
              {fresh > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => {
                      setText("");
                      setUrl({ q: null, status: "new", source: "website", assignee: null });
                    }}
                    className="font-medium text-ink underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {fresh} new website {fresh === 1 ? "enquiry" : "enquiries"}
                  </button>
                </>
              )}
            </>
          )
        }
        actions={newLeadButton}
      />

      {leads.length === 0 ? (
        <StateMessage
          icon={Users}
          title="No leads yet"
          description="Add an enquiry from a call, walk-in or Instagram. Website enquiries appear here automatically."
          action={newLeadButton}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div
              role="group"
              aria-label="Filter by stage"
              className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              {STATUS_TABS.map((tab) => {
                const on = filters.status === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ status: tab.value })}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "bg-ink text-white ring-ink" : "bg-card text-muted-foreground ring-border hover:text-ink",
                    )}
                  >
                    {tab.label}
                    <span className={cn("text-xs tabular-nums", on ? "text-white/80" : "text-muted-foreground")}>
                      {counts[tab.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form
                role="search"
                className="relative w-full sm:max-w-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (timer.current) clearTimeout(timer.current);
                  set({ q: text.trim() });
                }}
              >
                <label htmlFor="lead-search" className="sr-only">
                  Search leads
                </label>
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="lead-search"
                  type="search"
                  value={text}
                  placeholder="Search name, phone, area, requirement"
                  className="h-9 bg-card pl-8"
                  autoComplete="off"
                  onChange={(e) => {
                    const value = e.target.value;
                    setText(value);
                    if (timer.current) clearTimeout(timer.current);
                    timer.current = setTimeout(() => set({ q: value.trim() }), 300);
                  }}
                />
              </form>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <label className="sr-only" htmlFor="lead-source">
                  Source
                </label>
                <NativeSelect
                  id="lead-source"
                  value={filters.source}
                  onChange={(e) => set({ source: e.target.value as LeadSourceFilter })}
                  className="h-9 bg-card sm:w-40"
                >
                  <option value="all">All sources</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_SOURCE_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
                <label className="sr-only" htmlFor="lead-assignee">
                  Assigned to
                </label>
                <NativeSelect
                  id="lead-assignee"
                  value={filters.assignee}
                  onChange={(e) => set({ assignee: e.target.value as LeadAssigneeFilter })}
                  className="h-9 bg-card sm:w-40"
                >
                  <option value="all">Anyone</option>
                  <option value="me">Assigned to me</option>
                  <option value="unassigned">Unassigned</option>
                </NativeSelect>
              </div>
              {query.isFetching && (
                <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground sm:ml-auto" aria-label="Refreshing" />
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title="No leads match"
              description="Try a different search, stage or source."
              action={
                filtered ? (
                  <Button variant="outline" onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <LeadsTable leads={visible} people={people} meId={meId} />
          )}
        </>
      )}

      <LeadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lead={null}
        people={people}
        meId={meId}
        onSaved={(lead) => {
          if (!lead.id) return;
          toast.message("Open the lead to add a quote", {
            action: { label: "Open", onClick: () => router.push(`/app/sales/${lead.id}`) },
          });
        }}
      />
    </div>
  );
}

function Muted({ children }: { children?: React.ReactNode }) {
  return <span className="text-muted-foreground">{children ?? "—"}</span>;
}

/** Table on ≥768px, cards on phones. Fresh website enquiries get the brand accent. */
function LeadsTable({ leads, people, meId }: { leads: Lead[]; people: Person[]; meId: string }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Client</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="pr-4">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const fresh = isFreshEnquiry(lead);
              const assignee = assigneeLabel(lead, people, meId);
              return (
                <TableRow key={lead.id} className={cn("relative", fresh && "bg-sun/15 hover:bg-sun/25")}>
                  <TableCell className="max-w-64 pl-4">
                    <Link
                      href={`/app/sales/${lead.id}`}
                      className="flex items-center gap-1.5 truncate font-medium text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                    >
                      {fresh && (
                        <span className="relative z-10" title="New website enquiry">
                          <Sparkles className="size-3.5 text-amber-700" aria-label="New website enquiry" />
                        </span>
                      )}
                      <span className="truncate">{lead.clientName || "Unnamed lead"}</span>
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">{lead.clientPhone || "No phone"}</span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="block truncate">{lead.projectType || <Muted />}</span>
                    {lead.area && <span className="block truncate text-xs text-muted-foreground">{lead.area}</span>}
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={lead.source} />
                  </TableCell>
                  <TableCell className="max-w-32 truncate">{lead.estimatedBudget || <Muted />}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{assignee ?? <Muted>Unassigned</Muted>}</TableCell>
                  <TableCell className="pr-4 whitespace-nowrap tabular-nums">
                    <time dateTime={lead.createdAt} title={formatDate(lead.createdAt)} suppressHydrationWarning>
                      {formatRelative(lead.createdAt)}
                    </time>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {leads.map((lead) => {
          const fresh = isFreshEnquiry(lead);
          const assignee = assigneeLabel(lead, people, meId);
          return (
            <li key={lead.id}>
              <Link
                href={`/app/sales/${lead.id}`}
                className={cn(
                  "block rounded-xl bg-card p-4 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                  fresh && "bg-sun/15 ring-gold/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium text-ink">
                      {fresh && <Sparkles className="size-3.5 shrink-0 text-amber-700" aria-label="New website enquiry" />}
                      <span className="truncate">{lead.clientName || "Unnamed lead"}</span>
                    </p>
                    {lead.projectType && <p className="truncate text-sm text-muted-foreground">{lead.projectType}</p>}
                  </div>
                  <LeadStatusBadge status={lead.status} className="shrink-0" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {lead.clientPhone && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Phone className="size-3.5" aria-hidden />
                      {lead.clientPhone}
                    </span>
                  )}
                  {lead.area && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{lead.area}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" aria-hidden />
                    <time dateTime={lead.createdAt} suppressHydrationWarning>
                      {formatRelative(lead.createdAt)}
                    </time>
                  </span>
                  {assignee && (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3.5" aria-hidden />
                      {assignee}
                    </span>
                  )}
                  <SourceBadge source={lead.source} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
