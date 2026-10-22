"use client";

import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import type { Dispatch } from "react";
import { NativeSelect } from "@/components/project/form/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/format";
import { CATALOG_ITEM_TYPES, type CatalogItem, type CatalogItemType } from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";
import { TYPE_LABELS, TYPE_PLURALS, VARIANT_NOUN } from "./catalog-model";
import {
  TEMPLATE_LIMITS,
  estimateLine,
  lineSizeLabel,
  type DraftLine,
  type DraftSection,
  type LineStatus,
  type TemplateAction,
} from "./template-editor-model";

const STATUS_COPY: Partial<Record<LineStatus, string>> = {
  missing: "Not on the rate card",
  inactive: "Item deactivated",
  "variant-missing": "Option no longer exists",
};

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

function LineRow({
  line,
  index,
  count,
  sectionTitle,
  catalogById,
  haveRates,
  onEdit,
  onMove,
  onRemove,
}: {
  line: DraftLine;
  index: number;
  count: number;
  sectionTitle: string;
  catalogById: ReadonlyMap<string, CatalogItem>;
  haveRates: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const estimate = haveRates ? estimateLine(line, catalogById) : null;
  const problem = estimate ? STATUS_COPY[estimate.status] : undefined;
  const item = catalogById.get(line.catalogItemId);
  const name = item?.name || line.name || "Unnamed item";
  const label = `${name} in ${sectionTitle || "this room"}`;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center sm:px-4">
      <div className="min-w-0">
        <button
          type="button"
          onClick={onEdit}
          className="block max-w-full truncate text-left text-sm font-medium text-ink underline-offset-4 outline-none hover:underline focus-visible:underline"
        >
          {name}
        </button>
        <p className="text-xs break-words text-muted-foreground">
          {[estimate?.variantLabel || line.variantLabel, lineSizeLabel(line)].filter(Boolean).join(" · ")}
        </p>
        {problem && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-gold/20 px-1.5 py-0.5 text-xs font-medium text-ink">
            <TriangleAlert className="size-3" aria-hidden />
            {problem}
          </p>
        )}
      </div>
      <p className="order-3 col-span-2 text-sm tabular-nums text-muted-foreground sm:order-none sm:col-span-1 sm:text-right">
        <span className="sm:sr-only">Estimate: </span>
        {estimate ? (estimate.amount > 0 ? formatINR(estimate.amount) : "—") : "—"}
      </p>
      <div className="flex items-center gap-0.5">
        <IconButton label={`Move ${label} up`} onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowUp aria-hidden />
        </IconButton>
        <IconButton label={`Move ${label} down`} onClick={() => onMove(1)} disabled={index === count - 1}>
          <ArrowDown aria-hidden />
        </IconButton>
        <IconButton label={`Edit ${label}`} onClick={onEdit}>
          <Pencil aria-hidden />
        </IconButton>
        <IconButton label={`Remove ${label}`} onClick={onRemove}>
          <X aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}

/** One room of the template: editable title, type, ordered lines and a subtotal at today's rates. */
export function RoomCard({
  section,
  index,
  count,
  catalogById,
  haveRates,
  subtotal,
  titleError,
  canAddLines,
  dispatch,
  onAddLine,
  onEditLine,
  onRemove,
  onDuplicate,
}: {
  section: DraftSection;
  index: number;
  count: number;
  catalogById: ReadonlyMap<string, CatalogItem>;
  haveRates: boolean;
  subtotal: number;
  titleError?: string;
  canAddLines: boolean;
  dispatch: Dispatch<TemplateAction>;
  onAddLine: () => void;
  onEditLine: (lineKey: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const titleId = `room-title-${section.key}`;
  const roomName = section.title.trim() || `Room ${index + 1}`;
  const full = section.lines.length >= TEMPLATE_LIMITS.linesPerSection;

  return (
    <li className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-col gap-3 border-b bg-muted/30 px-3 py-3 sm:flex-row sm:items-start sm:px-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={titleId} className="sr-only">
            Room {index + 1} name
          </label>
          <Input
            id={titleId}
            value={section.title}
            placeholder="Room name"
            autoComplete="off"
            maxLength={TEMPLATE_LIMITS.sectionTitle + 10}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? `${titleId}-error` : undefined}
            className="h-9 bg-background font-heading text-base font-semibold text-ink md:text-base"
            onChange={(e) => dispatch({ type: "updateSection", key: section.key, title: e.target.value })}
          />
          {titleError && (
            <p id={`${titleId}-error`} className="mt-1 text-xs font-medium text-destructive">
              {titleError}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {section.lines.length === 0 ? (
            <>
              <label htmlFor={`${titleId}-type`} className="sr-only">
                {roomName} holds
              </label>
              <NativeSelect
                id={`${titleId}-type`}
                className="h-9"
                wrapperClassName="w-40"
                value={section.type}
                onChange={(e) =>
                  dispatch({ type: "updateSection", key: section.key, sectionType: e.target.value as CatalogItemType })
                }
              >
                {CATALOG_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_PLURALS[t]}
                  </option>
                ))}
              </NativeSelect>
            </>
          ) : (
            <Badge variant="secondary" title="A room's type is fixed once it has lines">
              {TYPE_PLURALS[section.type]}
            </Badge>
          )}
          <div className="flex items-center gap-0.5">
            <IconButton
              label={`Move ${roomName} up`}
              onClick={() => dispatch({ type: "moveSection", key: section.key, direction: -1 })}
              disabled={index === 0}
            >
              <ArrowUp aria-hidden />
            </IconButton>
            <IconButton
              label={`Move ${roomName} down`}
              onClick={() => dispatch({ type: "moveSection", key: section.key, direction: 1 })}
              disabled={index === count - 1}
            >
              <ArrowDown aria-hidden />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`More actions for ${roomName}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy aria-hidden />
                    Duplicate room
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" onClick={onRemove}>
                    <Trash2 aria-hidden />
                    Remove room
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {section.lines.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">
          No lines yet. Add the {TYPE_PLURALS[section.type].toLowerCase()} this room usually needs.
        </p>
      ) : (
        <>
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,1fr)_7rem_auto] gap-x-3 border-b px-4 py-1.5 text-xs font-medium text-muted-foreground sm:grid"
          >
            <span>
              Item · default {VARIANT_NOUN[section.type].toLowerCase()} · size
            </span>
            <span className="text-right">Estimate</span>
            <span className="w-[7.5rem]" />
          </div>
          <ol className={cn("divide-y")} aria-label={`Lines in ${roomName}`}>
            {section.lines.map((line, i) => (
              <LineRow
                key={line.key}
                line={line}
                index={i}
                count={section.lines.length}
                sectionTitle={roomName}
                catalogById={catalogById}
                haveRates={haveRates}
                onEdit={() => onEditLine(line.key)}
                onMove={(direction) => dispatch({ type: "moveLine", sectionKey: section.key, lineKey: line.key, direction })}
                onRemove={() => dispatch({ type: "removeLine", sectionKey: section.key, lineKey: line.key })}
              />
            ))}
          </ol>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5 sm:px-4">
        <Button type="button" variant="outline" size="sm" onClick={onAddLine} disabled={!canAddLines || full}>
          <Plus aria-hidden />
          Add {TYPE_LABELS[section.type].toLowerCase()}
        </Button>
        {haveRates && section.lines.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Room total <span className="font-medium tabular-nums text-ink">{formatINR(subtotal)}</span>
          </p>
        )}
      </div>
    </li>
  );
}
