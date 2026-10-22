"use client";

import { Copy, LayoutTemplate, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatINRCompact } from "@/lib/format";
import type { CatalogItem, QuoteTemplate } from "@/lib/api/sales-types";
import { errorMessage, useCatalogAdmin, useDeleteTemplate, useDuplicateTemplate, useTemplates } from "./queries";
import { ListSkeleton } from "./sales-admin-skeleton";
import { TEMPLATE_LIMITS, copyTitle, estimateTemplate, lineCount, toDraft } from "./template-editor-model";

function NewTemplateButton({ size = "lg" }: { size?: "lg" | "default" }) {
  return (
    <Link href="/app/quote-templates/new" className={buttonVariants({ size })}>
      <Plus aria-hidden />
      New template
    </Link>
  );
}

const editHref = (t: QuoteTemplate) => `/app/quote-templates/${encodeURIComponent(t.id)}`;

/** Head-only list of reusable quote skeletons ("Standard 3BHK"…). */
export function TemplatesList({
  initialTemplates,
  initialCatalog,
}: {
  initialTemplates?: QuoteTemplate[];
  initialCatalog?: CatalogItem[];
}) {
  const router = useRouter();
  const list = useTemplates(initialTemplates);
  const catalog = useCatalogAdmin(initialCatalog);
  const remove = useDeleteTemplate();
  const duplicate = useDuplicateTemplate();

  const [deleting, setDeleting] = useState<QuoteTemplate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const templates = useMemo(
    () => [...(list.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    [list.data],
  );
  const catalogById = useMemo(() => new Map((catalog.data ?? []).map((i) => [i.id, i])), [catalog.data]);
  const haveRates = catalog.isSuccess;

  const header = (
    <PageHeader
      title="Quote templates"
      description="Rooms and typical lines a new quote can start from. Rates come from the rate card when a quote is made."
      actions={
        <>
          <Link href="/app/rate-card" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
            Rate card
          </Link>
          <NewTemplateButton />
        </>
      }
    />
  );

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ListSkeleton withHeader={false} rows={4} />
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
          title="Couldn't load the templates"
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

      {templates.length === 0 ? (
        <StateMessage
          icon={LayoutTemplate}
          title="No templates yet"
          description="Build one for each common job — e.g. “Standard 2BHK” with a kitchen, wardrobes and electrical work — so new quotes start mostly filled in."
          action={<NewTemplateButton size="default" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const estimate = haveRates ? estimateTemplate(toDraft(t).sections, catalogById) : null;
            const lines = lineCount(t.sections);
            const busy = duplicate.isPending && duplicate.variables?.template.id === t.id;
            return (
              <li key={t.id} className="relative flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow focus-within:ring-2 focus-within:ring-ring/50 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-base font-semibold break-words text-ink">
                      <Link href={editHref(t)} className="outline-none after:absolute after:inset-0 after:rounded-xl">
                        {t.name || "Untitled template"}
                      </Link>
                    </h2>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t.sections.length} {t.sections.length === 1 ? "room" : "rooms"} · {lines} {lines === 1 ? "line" : "lines"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${t.name}`}
                      disabled={busy}
                      className="relative z-10 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => router.push(editHref(t))}>
                          <Pencil aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            duplicate.mutate({
                              template: t,
                              name: copyTitle(t.name, templates.map((x) => x.name)).slice(0, TEMPLATE_LIMITS.name),
                            })
                          }
                        >
                          <Copy aria-hidden />
                          Duplicate
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setDeleting(t);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {t.sections.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Rooms">
                    {t.sections.slice(0, 5).map((s, i) => (
                      <li key={`${s.title}-${i}`} className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs text-ink">
                        {s.title || "Untitled room"}
                      </li>
                    ))}
                    {t.sections.length > 5 && (
                      <li className="rounded-md px-1 py-0.5 text-xs text-muted-foreground">+{t.sections.length - 5} more</li>
                    )}
                  </ul>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                  {estimate ? (
                    <span className="text-muted-foreground">
                      About <span className="font-medium tabular-nums text-ink">{formatINRCompact(estimate.total)}</span> at
                      today&apos;s rates
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Estimate unavailable</span>
                  )}
                  {estimate && estimate.attention > 0 && (
                    <Badge variant="outline" className="border-gold bg-gold/15 text-ink">
                      <TriangleAlert aria-hidden />
                      {estimate.attention} to fix
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Quotes already made from it stay as they are. This can&apos;t be undone.
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
