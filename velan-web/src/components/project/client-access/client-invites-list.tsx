"use client";

import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INVITE_STATUS_LABELS, type ClientInvite, type ClientInviteStatus } from "@/lib/api/accounts";
import { formatDate, formatDateTime } from "@/lib/format";

const BADGE: Record<ClientInviteStatus, "outline" | "secondary" | "ghost"> = {
  valid: "outline",
  used: "secondary",
  expired: "ghost",
};

function StatusBadge({ status }: { status: ClientInviteStatus }) {
  return (
    <Badge variant={BADGE[status]} className={status === "expired" ? "text-muted-foreground" : undefined}>
      {INVITE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** "Expires 21 Oct 2026", "Accepted 15 Oct 2026", "Expired 2 Oct 2026". */
function WhenText({ invite }: { invite: ClientInvite }) {
  if (invite.status === "used") return <span title={formatDateTime(invite.usedAt)}>Accepted {formatDate(invite.usedAt)}</span>;
  if (invite.status === "expired") return <span title={formatDateTime(invite.expiresAt)}>Expired {formatDate(invite.expiresAt)}</span>;
  return <span title={formatDateTime(invite.expiresAt)}>Expires {formatDate(invite.expiresAt)}</span>;
}

function ResendButton({ invite, onResend }: { invite: ClientInvite; onResend: (invite: ClientInvite) => void }) {
  if (invite.status === "used") return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onResend(invite)}
      aria-label={`Create a new invite link for ${invite.displayName ?? invite.email ?? "this client"}`}
    >
      <RotateCcw data-icon="inline-start" aria-hidden />
      New link
    </Button>
  );
}

/** Invites for the project (never their tokens): status, dates and a "new link" shortcut. */
export function ClientInvitesList({
  invites,
  onResend,
}: {
  invites: ClientInvite[];
  onResend: (invite: ClientInvite) => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="max-w-64">
                  <span className="block truncate font-medium text-ink">{invite.displayName ?? "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {invite.email}
                    {invite.phone ? ` · ${invite.phone}` : ""}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={invite.status} />
                </TableCell>
                <TableCell className="tabular-nums">
                  <WhenText invite={invite} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(invite.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <ResendButton invite={invite} onResend={onResend} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col divide-y md:hidden">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{invite.displayName ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{invite.email}</p>
              </div>
              <StatusBadge status={invite.status} />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                <WhenText invite={invite} /> · sent {formatDate(invite.createdAt)}
              </span>
              <ResendButton invite={invite} onResend={onResend} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
