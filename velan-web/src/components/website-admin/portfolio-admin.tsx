"use client";

import { ExternalLink, Images, Loader2, Plus, RotateCcw, SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StateMessage } from "@/components/app-shell/states";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PortfolioItem, PortfolioStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { PortfolioList } from "./portfolio-list";
import {
  STATUS_FILTERS,
  STATUS_LABELS,
  countByStatus,
  filterByStatus,
  moveId,
  moveToTarget,
  type StatusFilter,
} from "./portfolio-rules";
import { errorMessage, useDeleteItem, usePortfolioList, useReorder, useSetStatus } from "./use-portfolio";
import { PortfolioListSkeleton } from "./website-skeleton";

const FILTER_LABELS: Record<StatusFilter, string> = { all: "All", ...STATUS_LABELS };
const EMPTY_FILTER: Record<PortfolioStatus, string> = {
  published: "Nothing is on the website yet. Publish a project to show it there.",
  draft: "No drafts. New projects start here until you publish them.",
  hidden: "No hidden projects.",
};

function AddProjectButton({ size = "lg" }: { size?: "lg" | "default" }) {
  return (
    <Link href="/app/website/new" className={buttonVariants({ size })}>
      <Plus aria-hidden />
      Add project
    </Link>
  );
}

/** Head-only website admin: the public portfolio's items, status and order. */
export function PortfolioAdmin({ initialItems }: { initialItems?: PortfolioItem[] }) {
  const list = usePortfolioList(initialItems);
  const setStatus = useSetStatus();
  const remove = useDeleteItem();
  const reorder = useReorder();

  const [filter, setFilter] = useState<StatusFilter>("all");
  // Kept after closing so the dialog text doesn't blank out during its exit animation.
  const [deleting, setDeleting] = useState<PortfolioItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const items = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const visible = useMemo(() => filterByStatus(items, filter), [items, filter]);

  const busyId = setStatus.isPending ? (setStatus.variables?.item.id ?? null) : null;

  const saveOrder = (ids: string[], movedId: string) => {
    if (ids.every((id, i) => id === items[i]?.id)) return;
    reorder.save(ids);
    const byId = new Map(items.map((i) => [i.id, i]));
    const visibleIds = ids.filter((id) => filter === "all" || byId.get(id)?.status === filter);
    const title = byId.get(movedId)?.title ?? "project";
    setAnnouncement(`Moved “${title}” to position ${visibleIds.indexOf(movedId) + 1} of ${visibleIds.length}.`);
  };

  const header = (
    <PageHeader
      title="Website"
      description="Projects in the portfolio on the public website. Published projects appear there in this order."
      actions={
        <>
          <a href="/portfolio" target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ExternalLink aria-hidden />
            View portfolio
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <AddProjectButton />
        </>
      }
    />
  );

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <PortfolioListSkeleton withHeader={false} />
      </div>
    );
  }

  if (list.isError && !list.data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <StateMessage
          icon={TriangleAlert}
          tone="warning"
          title="Couldn't load the portfolio"
          description={errorMessage(list.error)}
          action={
            <Button onClick={() => void list.refetch()} disabled={list.isFetching}>
              {list.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {list.isError && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>Couldn&apos;t refresh the list</AlertTitle>
          <AlertDescription>You may be seeing older data. {errorMessage(list.error)}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => void list.refetch()} disabled={list.isFetching}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      {items.length === 0 ? (
        <StateMessage
          icon={Images}
          title="Add your first project to the website"
          description="Add photos and a short description, then publish it to show it in the portfolio on the public website."
          action={<AddProjectButton size="default" />}
        />
      ) : (
        <>
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  filter === f ? "bg-ink text-white ring-ink" : "bg-card text-muted-foreground ring-foreground/15 hover:text-ink",
                )}
              >
                {FILTER_LABELS[f]}
                <span className={cn("tabular-nums", filter === f ? "text-white/80" : "text-muted-foreground")}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title={`No ${FILTER_LABELS[filter].toLowerCase()} projects`}
              description={filter === "all" ? undefined : EMPTY_FILTER[filter]}
              action={
                <Button variant="outline" onClick={() => setFilter("all")}>
                  Show all projects
                </Button>
              }
            />
          ) : (
            <PortfolioList
              items={visible}
              busyId={busyId}
              onMove={(item, direction) =>
                saveOrder(
                  moveId(
                    items.map((i) => i.id),
                    item.id,
                    direction,
                    visible.map((i) => i.id),
                  ),
                  item.id,
                )
              }
              onDropOnto={(draggedId, targetId) =>
                saveOrder(
                  moveToTarget(
                    items.map((i) => i.id),
                    draggedId,
                    targetId,
                  ),
                  draggedId,
                )
              }
              onStatusChange={(item, status) => setStatus.mutate({ item, status })}
              onDelete={(item) => {
                setDeleting(item);
                setDeleteOpen(true);
              }}
            />
          )}
        </>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.status === "published"
                ? "It will be removed from the website straight away. "
                : ""}
              This can&apos;t be undone. To take it off the website but keep it here, hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (!deleting) return;
                remove.mutate(deleting, { onSettled: () => setDeleteOpen(false) });
              }}
            >
              {remove.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
