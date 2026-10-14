"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleDot, CircleOff, Clock, MessageSquareWarning } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { StateMessage } from "@/components/app-shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { projectOps, projectOpsKeys, type Complaint, type ComplaintStatus } from "@/lib/api/project-ops";
import type { Role } from "@/lib/api/types";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttachmentList } from "./attachments";
import { ComplaintFormDialog } from "./complaint-form-dialog";
import { ComplaintStatusDialog } from "./complaint-status-dialog";
import {
  COMPLAINTS_POLL_MS,
  COMPLAINT_STATUS_LABEL,
  canManageComplaints,
  canRaiseComplaint,
  complaintCounts,
  normalizeComplaintStatus,
  sortComplaints,
} from "./support-model";
import { usePageVisible } from "./use-page-visible";

const STATUS_ICON: Record<ComplaintStatus, { icon: LucideIcon; tone: string }> = {
  open: { icon: CircleDot, tone: "text-warning" },
  inProgress: { icon: Clock, tone: "text-ink" },
  resolved: { icon: CircleCheck, tone: "text-success" },
  closed: { icon: CircleOff, tone: "text-muted-foreground" },
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const { icon: Icon, tone } = STATUS_ICON[status];
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className={tone} aria-hidden />
      {COMPLAINT_STATUS_LABEL[status]}
    </Badge>
  );
}

type Filter = "active" | "done" | "all";

export function ComplaintsPanel({ projectId, role }: { projectId: string; role: Role }) {
  const visible = usePageVisible();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Complaint | null>(null);
  const manage = canManageComplaints(role);

  const complaints = useQuery({
    queryKey: projectOpsKeys.complaints(projectId),
    queryFn: () => projectOps.listComplaints(projectId),
    refetchInterval: visible ? COMPLAINTS_POLL_MS : false,
  });

  const list = useMemo(() => sortComplaints(complaints.data ?? []), [complaints.data]);
  const counts = complaintCounts(list);
  const shown = list.filter((c) => {
    const s = normalizeComplaintStatus(c.status);
    if (filter === "active") return s === "open" || s === "inProgress";
    if (filter === "done") return s === "resolved" || s === "closed";
    return true;
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `All (${list.length})` },
    { value: "active", label: `Active (${counts.open + counts.inProgress})` },
    { value: "done", label: `Resolved (${counts.resolved + counts.closed})` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter complaints" className="inline-flex w-fit flex-wrap rounded-lg bg-muted p-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === f.value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canRaiseComplaint(role) && <ComplaintFormDialog projectId={projectId} staff={role !== "client"} />}
      </div>

      {complaints.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading complaints">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : complaints.isError && !complaints.data ? (
        <StateMessage
          icon={MessageSquareWarning}
          title={isApiError(complaints.error) && complaints.error.status === 403 ? "No access to complaints" : "Couldn't load complaints"}
          description={isApiError(complaints.error) ? complaints.error.message : undefined}
          action={
            <Button variant="outline" onClick={() => void complaints.refetch()}>
              Try again
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <StateMessage
          icon={MessageSquareWarning}
          title={list.length === 0 ? "No complaints" : "Nothing here"}
          description={
            list.length === 0
              ? role === "client"
                ? "If something isn't right, raise a complaint and the team will follow up."
                : "Complaints raised by the client appear here."
              : "No complaints match this filter."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((c) => {
            const status = normalizeComplaintStatus(c.status);
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium break-words text-ink">{c.title || "Untitled complaint"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {c.createdByName ? `Raised by ${c.createdByName} · ` : "Raised "}
                      <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                        {formatRelative(c.createdAt)}
                      </time>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ComplaintStatusBadge status={status} />
                    {manage && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                        Update
                        <span className="sr-only"> status of {c.title || "complaint"}</span>
                      </Button>
                    )}
                  </div>
                </div>
                {c.description && <p className="text-sm break-words whitespace-pre-line text-ink">{c.description}</p>}
                <AttachmentList urls={c.attachments ?? []} />
                {c.resolutionNote && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      Resolution{c.resolvedAt ? ` · ${formatDate(c.resolvedAt)}` : ""}
                    </p>
                    <p className="mt-0.5 break-words whitespace-pre-line text-ink">{c.resolutionNote}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {manage && (
        <ComplaintStatusDialog
          projectId={projectId}
          complaint={editing}
          onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        />
      )}
    </div>
  );
}
