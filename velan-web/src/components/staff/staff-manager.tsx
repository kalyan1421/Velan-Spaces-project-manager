"use client";

import { RefreshCw, Search, SearchX, UserPlus, Users } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StateMessage } from "@/components/app-shell/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterStaff, sortStaff, type StaffMember, type StaffRoleFilter } from "@/lib/api/accounts";
import { cn } from "@/lib/utils";
import { ResetLinkDialog } from "./reset-link-dialog";
import { StaffCreateDialog } from "./staff-create-dialog";
import { StaffDeleteDialog } from "./staff-delete-dialog";
import { StaffEditDialog } from "./staff-edit-dialog";
import { StaffTable, type StaffAction } from "./staff-table";
import { useStaff } from "./use-staff";

type Active = { action: StaffAction; member: StaffMember; open: boolean } | null;

const FILTERS: { value: StaffRoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manager", label: "Managers" },
  { value: "worker", label: "Workers" },
];

/** Head-only staff management: list, filter, create, edit/suspend, reset links, delete. */
export function StaffManager({
  initialStaff,
  projectNames,
  currentUserId,
}: {
  initialStaff: StaffMember[];
  /** Project id → name, for the "N projects" popovers. */
  projectNames: Record<string, string>;
  currentUserId: string;
}) {
  const query = useStaff(initialStaff);
  const staff = query.data;
  const [role, setRole] = useState<StaffRoleFilter>("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [createOpen, setCreateOpen] = useState(false);
  const [active, setActive] = useState<Active>(null);

  const visible = useMemo(() => sortStaff(filterStaff(staff, { role, q: deferredQ })), [staff, role, deferredQ]);
  const counts = useMemo(
    () => ({
      all: staff.length,
      manager: staff.filter((m) => m.role === "manager").length,
      worker: staff.filter((m) => m.role === "worker").length,
    }),
    [staff],
  );

  const open = (action: StaffAction, member: StaffMember) => setActive({ action, member, open: true });
  // Keep the member while the dialog animates out; the dialogs unmount their content on close.
  const dialogProps = (action: StaffAction) => ({
    member: active?.action === action ? active.member : null,
    open: active?.action === action && active.open,
    onOpenChange: (next: boolean) => setActive((cur) => (cur && cur.action === action ? { ...cur, open: next } : cur)),
  });

  const addButton = (
    <Button size="lg" onClick={() => setCreateOpen(true)}>
      <UserPlus data-icon="inline-start" aria-hidden />
      Add staff
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Staff"
        description={
          staff.length === 0
            ? "Managers and workers who can sign in to Velan Spaces."
            : `${counts.manager} ${counts.manager === 1 ? "manager" : "managers"} · ${counts.worker} ${counts.worker === 1 ? "worker" : "workers"}`
        }
        actions={addButton}
      />

      {staff.length === 0 ? (
        <StateMessage
          icon={Users}
          title="No staff accounts yet"
          description="Add managers (they sign in with email) and workers (they sign in with a username)."
          action={addButton}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="search" className="relative w-full sm:max-w-xs">
              <label htmlFor="staff-search" className="sr-only">
                Search staff
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="staff-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, login, phone, trade"
                autoComplete="off"
                className="h-9 bg-card pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              {query.isFetching && (
                <RefreshCw className="size-4 animate-spin text-muted-foreground" aria-label="Refreshing" />
              )}
              <div role="group" aria-label="Filter by role" className="inline-flex w-fit rounded-lg bg-muted p-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={role === f.value}
                    onClick={() => setRole(f.value)}
                    className={cn(
                      "h-8 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      role === f.value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                    )}
                  >
                    {f.label}
                    <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{counts[f.value]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {visible.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title="No one matches"
              description="Try a different search or role."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setRole("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <StaffTable staff={visible} projectNames={projectNames} currentUserId={currentUserId} onAction={open} />
          )}
        </>
      )}

      <StaffCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <StaffEditDialog {...dialogProps("edit")} />
      <ResetLinkDialog {...dialogProps("reset")} />
      <StaffDeleteDialog {...dialogProps("delete")} />
    </div>
  );
}
