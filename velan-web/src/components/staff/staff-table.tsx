"use client";

import { KeyRound, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffLogin, type StaffMember } from "@/lib/api/accounts";
import { cn } from "@/lib/utils";
import { AssignedProjects } from "./assigned-projects";

export type StaffAction = "edit" | "reset" | "delete";

type Props = {
  staff: StaffMember[];
  projectNames: Readonly<Record<string, string>>;
  currentUserId: string;
  onAction: (action: StaffAction, member: StaffMember) => void;
};

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const nameOf = (m: StaffMember) => m.displayName?.trim() || m.username || "Unnamed";
const ROLE_LABEL = { manager: "Manager", worker: "Worker" } as const;

function Login({ member }: { member: StaffMember }) {
  const login = staffLogin(member);
  if (!login) {
    return (
      <Badge variant="outline" title={member.role === "worker" ? "Add a username so they can sign in" : "Add an email"}>
        No sign-in name
      </Badge>
    );
  }
  return (
    <span className={cn("block max-w-56 truncate", login.kind === "username" && "font-mono text-[0.8125rem]")} title={login.value}>
      {login.value}
    </span>
  );
}

function Status({ member }: { member: StaffMember }) {
  return member.isSuspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>;
}

function RowActions({ member, isSelf, onAction }: { member: StaffMember; isSelf: boolean; onAction: Props["onAction"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${nameOf(member)}`}
        className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAction("edit", member)}>
            <Pencil aria-hidden />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("reset", member)}>
            <KeyRound aria-hidden />
            Reset password link
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={() => onAction("delete", member)}>
                <Trash2 aria-hidden />
                Delete account
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Staff as a table (≥768px) and as cards (phones). */
export function StaffTable({ staff, projectNames, currentUserId, onAction }: Props) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((m) => (
              <TableRow key={m.id} className={cn(m.isSuspended && "text-muted-foreground")}>
                <TableCell className="max-w-64 pl-4">
                  <span className="block truncate font-medium text-ink">{nameOf(m)}</span>
                  <span className="block text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                </TableCell>
                <TableCell>
                  <Login member={m} />
                </TableCell>
                <TableCell>
                  {m.phone ? (
                    <a href={telHref(m.phone)} className="tabular-nums underline-offset-4 hover:underline">
                      {m.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-40 truncate">
                  {m.role === "worker" && m.trade ? m.trade : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Status member={m} />
                </TableCell>
                <TableCell>
                  <AssignedProjects ids={m.assignedProjects} projectNames={projectNames} personName={nameOf(m)} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <RowActions member={m} isSelf={m.id === currentUserId} onAction={onAction} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {staff.map((m) => (
          <li key={m.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{nameOf(m)}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[m.role]}
                  {m.role === "worker" && m.trade ? ` · ${m.trade}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Status member={m} />
                <RowActions member={m} isSelf={m.id === currentUserId} onAction={onAction} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Sign-in</dt>
                <dd className="min-w-0">
                  <Login member={m} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Projects</dt>
                <dd className="-ml-2">
                  <AssignedProjects ids={m.assignedProjects} projectNames={projectNames} personName={nameOf(m)} />
                </dd>
              </div>
              {m.phone && (
                <div className="col-span-2">
                  <dt className="sr-only">Phone</dt>
                  <dd>
                    <a href={telHref(m.phone)} className="inline-flex items-center gap-1.5 text-ink underline-offset-4 hover:underline">
                      <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="tabular-nums">{m.phone}</span>
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
