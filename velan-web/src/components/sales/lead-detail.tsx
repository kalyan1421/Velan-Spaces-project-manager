"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Wallet,
  Briefcase,
  UserRound,
  CalendarDays,
  Megaphone,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageHeader } from "@/components/app-shell/page-header";
import { ForbiddenState } from "@/components/app-shell/states";
import { ConfirmDeleteDialog } from "@/components/project/budget/confirm-delete-dialog";
import { useUnsavedChangesWarning } from "@/components/project/form/use-unsaved-changes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type Lead, type LeadStatus, type Quote } from "@/lib/api/sales-types";
import type { Role } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LeadFormDialog } from "./lead-form-dialog";
import { LEAD_LIMITS } from "./lead-form-schema";
import { assigneeLabel, telUrl, whatsappUrl, type Person } from "./lead-model";
import { LeadQuotes } from "./lead-quotes";
import { NewQuoteDialog } from "./new-quote-dialog";
import { LeadStatusBadge, SourceBadge, leadStatusDot } from "./status-badges";
import { isForbidden, useDeleteLead, useLead, useLeadQuotes, useUpdateLead } from "./use-sales";

type Me = { id: string; role: Role; name: string };

/** One lead: contact, stage, notes and its quotations. Delete is head-only. */
export function LeadDetail({
  initialLead,
  initialQuotes,
  people,
  me,
}: {
  initialLead: Lead;
  initialQuotes: Quote[];
  people: Person[];
  me: Me;
}) {
  const router = useRouter();
  const leadQuery = useLead(initialLead.id, initialLead);
  const quotesQuery = useLeadQuotes(initialLead.id, initialQuotes);
  const lead = leadQuery.data;
  const quotes = (quotesQuery.data ?? []).filter((q) => !q.leadId || q.leadId === lead.id);
  const update = useUpdateLead(lead.id);
  const remove = useDeleteLead();

  const [editOpen, setEditOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReturn, setDeleteReturn] = useState<HTMLElement | null>(null);

  if (isForbidden(leadQuery.error)) return <ForbiddenState backHref="/app/sales" backLabel="Back to sales" />;

  const name = lead.clientName || "Unnamed lead";
  const isHead = me.role === "head";
  const tel = telUrl(lead.clientPhone);
  const wa = whatsappUrl(lead.clientPhone);

  const changeStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;
    try {
      await update.mutateAsync({ status });
      toast.success(`Moved to ${LEAD_STATUS_LABELS[status]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't change the stage.");
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync(lead.id);
      toast.success(`${name} deleted`);
      setDeleteOpen(false);
      router.replace("/app/sales");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't delete the lead.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <SetBreadcrumbs items={[{ label: "Sales", href: "/app/sales" }, { label: name }]} />

      <div className="flex flex-col gap-3">
        <Link
          href="/app/sales"
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All leads
        </Link>
        <PageHeader
          title={name}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <LeadStatusBadge status={lead.status} />
              <SourceBadge source={lead.source} />
              <span>Added {formatDate(lead.createdAt)}</span>
            </span>
          }
          actions={
            <>
              {tel && (
                <a href={tel} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  <Phone data-icon="inline-start" aria-hidden />
                  Call
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  <MessageCircle data-icon="inline-start" aria-hidden />
                  WhatsApp
                </a>
              )}
              <Button variant="outline" size="lg" onClick={() => setEditOpen(true)}>
                <Pencil data-icon="inline-start" aria-hidden />
                Edit
              </Button>
              {isHead && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    id="lead-more-actions"
                    aria-label="More actions"
                    className={buttonVariants({ variant: "outline", size: "icon-lg" })}
                  >
                    <MoreHorizontal aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteReturn(document.getElementById("lead-more-actions"));
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 aria-hidden />
                      Delete lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button size="lg" onClick={() => setQuoteOpen(true)}>
                <Plus data-icon="inline-start" aria-hidden />
                New quote
              </Button>
            </>
          }
        />
      </div>

      <StageStepper status={lead.status} pending={update.isPending} onChange={(s) => void changeStatus(s)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <LeadQuotes quotes={quotes} canDelete={isHead} onNewQuote={() => setQuoteOpen(true)} />
          <NotesCard key={lead.notes ?? ""} lead={lead} />
        </div>
        <DetailsCard lead={lead} assignee={assigneeLabel(lead, people, me.id)} />
      </div>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} people={people} meId={me.id} />
      <NewQuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} lead={lead} handledBy={me.name} />
      {isHead && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          title={`Delete ${name}?`}
          description={
            quotes.length > 0
              ? `The lead and its ${quotes.length === 1 ? "quote are" : `${quotes.length} quotes are`} removed for everyone. This can't be undone.`
              : "The lead is removed for everyone. This can't be undone."
          }
          pending={remove.isPending}
          onConfirm={() => void onDelete()}
          onCancel={() => setDeleteOpen(false)}
          returnFocus={deleteReturn}
        />
      )}
    </div>
  );
}

/** Pipeline stages as a segmented control; Won/Lost close the lead. */
function StageStepper({
  status,
  pending,
  onChange,
}: {
  status: string;
  pending: boolean;
  onChange: (status: LeadStatus) => void;
}) {
  const index = LEAD_STATUSES.indexOf(status as LeadStatus);
  const closed = status === "won" || status === "lost";
  return (
    <div role="group" aria-label="Lead stage" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max gap-1.5 rounded-xl bg-card p-1.5 ring-1 ring-foreground/10 sm:min-w-0">
        {LEAD_STATUSES.map((s, i) => {
          const current = s === status;
          const done = !closed && index >= 0 && i < index && i < 4;
          return (
            <li key={s} className="flex-1">
              <button
                type="button"
                aria-pressed={current}
                disabled={pending && !current}
                onClick={() => onChange(s)}
                className={cn(
                  "flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                  current ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted hover:text-ink",
                )}
              >
                {done ? (
                  <Check className="size-3.5 text-success" aria-hidden />
                ) : (
                  <span aria-hidden className={cn("size-1.5 rounded-full", current ? "bg-gold" : leadStatusDot(s))} />
                )}
                {LEAD_STATUS_LABELS[s]}
                {current && pending && <Loader2 className="size-3.5 animate-spin" aria-label="Saving" />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-ink">{children}</dd>
      </div>
    </div>
  );
}

function DetailsCard({ lead, assignee }: { lead: Lead; assignee: string | null }) {
  const tel = telUrl(lead.clientPhone);
  const none = <span className="text-muted-foreground">Not recorded</span>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="-my-2.5 divide-y">
          <Row icon={Phone} label="Phone">
            {lead.clientPhone ? (
              tel ? (
                <a href={tel} className="font-medium tabular-nums underline-offset-4 hover:underline">
                  {lead.clientPhone}
                </a>
              ) : (
                lead.clientPhone
              )
            ) : (
              none
            )}
          </Row>
          <Row icon={MapPin} label="Area / location">
            {lead.area || none}
          </Row>
          <Row icon={Briefcase} label="Requirement">
            {lead.projectType || none}
          </Row>
          <Row icon={Wallet} label="Estimated budget">
            {lead.estimatedBudget || none}
          </Row>
          <Row icon={Megaphone} label="Source">
            <SourceBadge source={lead.source} />
          </Row>
          <Row icon={UserRound} label="Assigned to">
            {assignee ?? <span className="text-muted-foreground">Unassigned</span>}
          </Row>
          <Row icon={CalendarDays} label="Added">
            {formatDate(lead.createdAt)}
          </Row>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Inline notes editor; remounted (via key) when the saved notes change. */
function NotesCard({ lead }: { lead: Lead }) {
  const update = useUpdateLead(lead.id);
  const [text, setText] = useState(lead.notes ?? "");
  const dirty = text.trim() !== (lead.notes ?? "").trim();
  const tooLong = text.length > LEAD_LIMITS.notes;
  useUnsavedChangesWarning(dirty);

  const save = async () => {
    try {
      await update.mutateAsync({ notes: text.trim() || null });
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't save the notes.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <label htmlFor="lead-notes">Notes</label>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          id="lead-notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          aria-invalid={tooLong || undefined}
          aria-describedby="lead-notes-hint"
          placeholder="Calls, site-visit notes, what the client liked…"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty && !tooLong) void save();
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p id="lead-notes-hint" className={cn("text-xs", tooLong ? "text-destructive" : "text-muted-foreground")}>
            {tooLong ? `Keep notes under ${LEAD_LIMITS.notes.toLocaleString("en-IN")} characters.` : dirty ? "Unsaved changes" : "Saved"}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setText(lead.notes ?? "")} disabled={update.isPending}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={() => void save()} disabled={!dirty || tooLong || update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Save notes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
