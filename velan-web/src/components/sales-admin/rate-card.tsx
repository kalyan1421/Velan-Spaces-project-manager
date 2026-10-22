"use client";

import { Loader2, Plus, RotateCcw, Search, SearchX, Tags, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StateMessage } from "@/components/app-shell/states";
import { NativeSelect } from "@/components/project/form/native-select";
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
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { CATALOG_ITEM_TYPES, type CatalogItem, type QuoteTemplate } from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";
import { CatalogItemDialog } from "./catalog-item-dialog";
import {
  TYPE_PLURALS,
  countByType,
  filterCatalog,
  groupCatalog,
  sectionSuggestions,
  templatesUsingItem,
  type StatusFilter,
  type TypeFilter,
} from "./catalog-model";
import { CatalogGroupTable, type CatalogAction } from "./catalog-table";
import { errorMessage, useCatalogAdmin, useSetCatalogItemActive, useTemplates } from "./queries";
import { ListSkeleton } from "./sales-admin-skeleton";

const TYPE_FILTERS: TypeFilter[] = ["all", ...CATALOG_ITEM_TYPES];
const TYPE_FILTER_LABELS: Record<TypeFilter, string> = { all: "All", ...TYPE_PLURALS };
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Active and inactive",
  active: "Active only",
  inactive: "Inactive only",
};

/**
 * The rate card: every catalog item grouped by type and section, with search
 * and filters. The head edits it; managers get a read-only view.
 */
export function RateCard({
  initialItems,
  initialTemplates,
  readOnly,
}: {
  initialItems?: CatalogItem[];
  initialTemplates?: QuoteTemplate[];
  readOnly: boolean;
}) {
  const list = useCatalogAdmin(initialItems);
  // Only the head edits, so only the head needs template usage (delete warnings).
  const templates = useTemplates(initialTemplates, !readOnly);
  const setActive = useSetCatalogItemActive();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  // Managers only ever see active items (what they can quote with).
  const defaultStatus: StatusFilter = readOnly ? "active" : "all";
  const [status, setStatus] = useState<StatusFilter>(defaultStatus);
  const deferredQuery = useDeferredValue(query);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  // Kept after closing so the dialog text doesn't blank out during its exit animation.
  const [deactivating, setDeactivating] = useState<CatalogItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const items = useMemo(() => (list.data ?? []).filter((i) => !readOnly || i.active), [list.data, readOnly]);
  const counts = useMemo(() => countByType(filterCatalog(items, { status })), [items, status]);
  const visible = useMemo(() => filterCatalog(items, { query: deferredQuery, type, status }), [items, deferredQuery, type, status]);
  const groups = useMemo(() => groupCatalog(visible), [visible]);
  const sections = useMemo(() => sectionSuggestions(items), [items]);
  const usage = (item: CatalogItem | null) => (item ? templatesUsingItem(templates.data ?? [], item.id) : []);

  const busyId = setActive.isPending ? (setActive.variables?.item.id ?? null) : null;
  const filtered = deferredQuery.trim() !== "" || type !== "all" || status !== defaultStatus;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const onAction = (action: CatalogAction, item: CatalogItem) => {
    if (action === "edit") {
      setEditing(item);
      setDialogOpen(true);
    } else if (action === "activate") {
      setActive.mutate({ item, active: true });
    } else {
      setDeactivating(item);
      setConfirmOpen(true);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setType("all");
    setStatus(defaultStatus);
  };

  const header = (
    <PageHeader
      title="Rate card"
      description={
        readOnly
          ? "Current rates the quote builder uses. Only the admin can change them."
          : "Items and rates the quote builder prices from. Changes apply to new quotes; saved quotes keep their rates."
      }
      actions={
        readOnly ? undefined : (
          <>
            <Link href="/app/quote-templates" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
              Templates
            </Link>
            <Button size="lg" onClick={openCreate}>
              <Plus aria-hidden />
              Add item
            </Button>
          </>
        )
      }
    />
  );

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ListSkeleton withHeader={false} />
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
          title="Couldn't load the rate card"
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

  const confirmUsage = usage(deactivating);

  return (
    <div className="flex flex-col gap-6">
      {header}

      {list.isError && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>Couldn&apos;t refresh the rate card</AlertTitle>
          <AlertDescription>You may be seeing older rates. {errorMessage(list.error)}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => void list.refetch()} disabled={list.isFetching}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      {items.length === 0 ? (
        <StateMessage
          icon={Tags}
          title={readOnly ? "The rate card is empty" : "Start your rate card"}
          description={
            readOnly
              ? "The admin hasn't added any items yet."
              : "Add the modular units, accessories and services you quote for, with a rate for each variant or brand."
          }
          action={
            readOnly ? undefined : (
              <Button onClick={openCreate}>
                <Plus aria-hidden />
                Add your first item
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <InputGroup className="h-9 sm:max-w-sm">
                <InputGroupAddon>
                  <Search aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search items, sections, brands…"
                  aria-label="Search the rate card"
                  autoComplete="off"
                />
                {query && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
                      <X aria-hidden />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
              {!readOnly && (
                <>
                  <label htmlFor="rate-card-status" className="sr-only">
                    Show
                  </label>
                  <NativeSelect
                    id="rate-card-status"
                    className="h-9"
                    wrapperClassName="sm:w-48"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  >
                    {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </>
              )}
            </div>

            <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={type === f}
                  onClick={() => setType(f)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    type === f ? "bg-ink text-white ring-ink" : "bg-card text-muted-foreground ring-foreground/15 hover:text-ink",
                  )}
                >
                  {TYPE_FILTER_LABELS[f]}
                  <span className={cn("tabular-nums", type === f ? "text-white/80" : "text-muted-foreground")}>{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

          <p aria-live="polite" className="sr-only">
            {filtered ? `${visible.length} ${visible.length === 1 ? "item" : "items"} shown` : ""}
          </p>

          {groups.length === 0 ? (
            <StateMessage
              icon={SearchX}
              title="No items match"
              description={deferredQuery.trim() ? `Nothing on the rate card matches “${deferredQuery.trim()}”.` : "Try a different filter."}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map((group) => (
                <CatalogGroupTable key={group.type} group={group} readOnly={readOnly} busyId={busyId} onAction={onAction} />
              ))}
            </div>
          )}
        </>
      )}

      {!readOnly && (
        <CatalogItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          item={editing}
          sectionOptions={sections}
          usedInTemplates={usage(editing).length}
          returnFocus={null}
        />
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !setActive.isPending) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate “{deactivating?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves the quote builder, so new quotes can&apos;t use it. Items are never fully deleted because saved
              quotes refer to them; those quotes keep their lines and rates.
              {confirmUsage.length > 0 && (
                <>
                  {" "}
                  {confirmUsage.length === 1 ? "The template " : `${confirmUsage.length} templates, including `}
                  {confirmUsage
                    .slice(0, 2)
                    .map((t) => `“${t.name}”`)
                    .join(" and ")}
                  , use it: those lines are flagged until you replace them.
                </>
              )}{" "}
              You can make it active again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setActive.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={setActive.isPending}
              onClick={() => {
                if (!deactivating) return;
                setActive.mutate({ item: deactivating, active: false }, { onSettled: () => setConfirmOpen(false) });
              }}
            >
              {setActive.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {setActive.isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
