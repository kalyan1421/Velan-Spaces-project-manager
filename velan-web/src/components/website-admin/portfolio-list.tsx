"use client";

import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, type DragEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PortfolioItem, PortfolioStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { PortfolioImage } from "./portfolio-image";
import { PortfolioRowMenu } from "./portfolio-row-menu";
import { CATEGORY_LABELS, canViewOnSite, coverOf, publicPath } from "./portfolio-rules";
import { PortfolioStatusBadge } from "./status-badge";

type RowHandlers = {
  onMove: (item: PortfolioItem, direction: "up" | "down") => void;
  onStatusChange: (item: PortfolioItem, status: PortfolioStatus) => void;
  onDelete: (item: PortfolioItem) => void;
};

function meta(item: PortfolioItem): string {
  return [CATEGORY_LABELS[item.category], item.location, item.completionYear ? String(item.completionYear) : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Portfolio items in website order. Reorder with the arrow buttons (keyboard,
 * touch) or by dragging the grip (desktop). `items` may be a filtered view;
 * moves are applied to the full order by the parent.
 */
export function PortfolioList({
  items,
  busyId,
  onDropOnto,
  ...handlers
}: RowHandlers & {
  items: PortfolioItem[];
  /** Row with a status change in flight. */
  busyId: string | null;
  onDropOnto: (draggedId: string, targetId: string) => void;
}) {
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const reset = () => {
    setArmedId(null);
    setDragId(null);
    setOverId(null);
  };

  const dragProps = (item: PortfolioItem) => ({
    draggable: armedId === item.id,
    onDragStart: (e: DragEvent<HTMLLIElement>) => {
      setDragId(item.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.id);
    },
    onDragOver: (e: DragEvent<HTMLLIElement>) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overId !== item.id) setOverId(item.id);
    },
    onDrop: (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      if (dragId && dragId !== item.id) onDropOnto(dragId, item.id);
      reset();
    },
    onDragEnd: reset,
  });

  return (
    <ol aria-label="Portfolio projects in website order" className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          {...dragProps(item)}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-shadow md:flex-nowrap",
            dragId === item.id && "opacity-50",
            overId === item.id && dragId !== item.id && "ring-2 ring-gold",
          )}
        >
          <span
            aria-hidden
            title="Drag to reorder"
            onPointerDown={() => setArmedId(item.id)}
            onPointerUp={() => setArmedId(null)}
            className="hidden h-14 w-5 shrink-0 cursor-grab place-items-center text-muted-foreground hover:text-ink active:cursor-grabbing md:grid"
          >
            <GripVertical className="size-4" />
          </span>

          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
            <PortfolioImage src={coverOf(item)} sizes="80px" />
          </div>

          <div className="min-w-0 flex-1 basis-40">
            <Link
              href={`/app/website/${item.id}`}
              className="block truncate rounded-sm font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{meta(item) || "No details yet"}</p>
            <p className="hidden truncate font-mono text-xs text-muted-foreground lg:block">{publicPath(item.slug)}</p>
          </div>

          <PortfolioStatusBadge status={item.status} className="shrink-0" />

          <Row item={item} index={index} count={items.length} busy={busyId === item.id} {...handlers} />
        </li>
      ))}
    </ol>
  );
}

function Row({
  item,
  index,
  count,
  busy,
  onMove,
  onStatusChange,
  onDelete,
}: RowHandlers & { item: PortfolioItem; index: number; count: number; busy: boolean }) {
  const first = index === 0;
  const last = index === count - 1;

  return (
    <div className="flex w-full items-center justify-end gap-1 border-t pt-2 md:w-auto md:border-0 md:pt-0">
      <span className="mr-auto text-xs tabular-nums text-muted-foreground md:hidden">#{index + 1}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={first}
        focusableWhenDisabled
        aria-label={`Move “${item.title}” up`}
        onClick={() => onMove(item, "up")}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={last}
        focusableWhenDisabled
        aria-label={`Move “${item.title}” down`}
        onClick={() => onMove(item, "down")}
      >
        <ArrowDown aria-hidden />
      </Button>

      {canViewOnSite(item) ? (
        <a
          href={publicPath(item.slug)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View “${item.title}” on the website (opens in a new tab)`}
          title="View on site"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ExternalLink aria-hidden />
        </a>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatusChange(item, "published")}>
          {busy && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          Publish
        </Button>
      )}

      <Link href={`/app/website/${item.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Edit
      </Link>

      <PortfolioRowMenu item={item} disabled={busy} onStatusChange={onStatusChange} onDelete={onDelete} />
    </div>
  );
}
