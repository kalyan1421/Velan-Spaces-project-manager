"use client";

import { Loader2, Plus, Save, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { PageHeader } from "@/components/app-shell/page-header";
import { useUnsavedChangesGuard } from "@/components/website-admin/unsaved-changes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { formatINR } from "@/lib/format";
import { CATALOG_ITEM_TYPES, type CatalogItem, type CatalogItemType, type QuoteTemplate } from "@/lib/api/sales-types";
import { sectionSuggestions } from "./catalog-model";
import { useCatalogAdmin, useSaveTemplate } from "./queries";
import { RoomCard } from "./room-card";
import { RoomDialog } from "./room-dialog";
import {
  TEMPLATE_LIMITS,
  copyTitle,
  estimateTemplate,
  hasErrors,
  lineCount,
  newKey,
  serializeDraft,
  templateReducer,
  toDraft,
  toTemplateBody,
  validateTemplate,
  type TemplateErrors,
} from "./template-editor-model";
import { TemplateLineDialog } from "./template-line-dialog";

const LIST_HREF = "/app/quote-templates";

type LineTarget = { sectionKey: string; lineKey: string | null };

/** Create / edit a quote template: rooms, and lines picked from the rate card. Saved in one request. */
export function TemplateEditor({
  template,
  initialCatalog,
}: {
  /** The saved template (edit) or undefined (create). */
  template?: QuoteTemplate;
  initialCatalog?: CatalogItem[];
}) {
  const router = useRouter();
  const save = useSaveTemplate();
  const catalogQuery = useCatalogAdmin(initialCatalog);
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogById = useMemo(() => new Map(catalog.map((i) => [i.id, i])), [catalog]);

  // The last saved version: `dirty` compares against it.
  const [original, setOriginal] = useState<QuoteTemplate | undefined>(template);
  const [baseline, setBaseline] = useState(() => serializeDraft(toDraft(template ?? null)));
  const [draft, dispatch] = useReducer(templateReducer, template ?? null, toDraft);
  const [errors, setErrors] = useState<TemplateErrors | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const [roomOpen, setRoomOpen] = useState(false);
  const [lineTarget, setLineTarget] = useState<LineTarget | null>(null);
  const [lineOpen, setLineOpen] = useState(false);
  const [removing, setRemoving] = useState<{ key: string; title: string; lines: number } | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const dirty = serializeDraft(draft) !== baseline;
  const { confirmLeave, allowLeave } = useUnsavedChangesGuard(dirty);

  const estimate = useMemo(() => estimateTemplate(draft.sections, catalogById), [draft.sections, catalogById]);
  const haveRates = catalogQuery.isSuccess;
  const lines = lineCount(draft.sections);
  const suggestions = useMemo(
    () =>
      Object.fromEntries(CATALOG_ITEM_TYPES.map((t) => [t, sectionSuggestions(catalog, t)])) as Record<
        CatalogItemType,
        string[]
      >,
    [catalog],
  );

  // Live re-validation once a save has been attempted.
  const shownErrors = errors ? validateTemplate(draft) : null;

  const targetSection = lineTarget ? draft.sections.find((s) => s.key === lineTarget.sectionKey) : undefined;
  const targetLine =
    lineTarget?.lineKey && targetSection ? (targetSection.lines.find((l) => l.key === lineTarget.lineKey) ?? null) : null;

  const openLine = (target: LineTarget) => {
    setLineTarget(target);
    setLineOpen(true);
  };

  const onSave = async () => {
    setServerErrors([]);
    const found = validateTemplate(draft);
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("Fix the highlighted fields before saving.");
      if (found.name) nameRef.current?.focus();
      else document.getElementById(`room-title-${Object.keys(found.sections)[0]}`)?.focus();
      return;
    }
    setErrors(null);
    const body = toTemplateBody(draft);
    try {
      const saved = await save.mutateAsync({ id: original?.id ?? null, body });
      if (!original) {
        toast.success(`Created “${saved.name || body.name}”.`);
        // The page is kept alive (Activity) after we leave: start the next visit fresh.
        dispatch({ type: "reset", template: null });
        allowLeave();
        router.push(saved.id ? `${LIST_HREF}/${encodeURIComponent(saved.id)}` : LIST_HREF);
        return;
      }
      const next: QuoteTemplate = saved.id ? saved : { ...original, ...body };
      setOriginal(next);
      dispatch({ type: "reset", template: next });
      setBaseline(serializeDraft(toDraft(next)));
      toast.success(`Saved “${next.name}”.`);
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        setServerErrors(["This template no longer exists. It may have been deleted in another tab."]);
        return;
      }
      setServerErrors(isApiError(error) ? error.messages : ["Something went wrong. Please try again."]);
    }
  };

  const discard = () => {
    if (!dirty) return;
    if (!window.confirm("Discard your unsaved changes?")) return;
    dispatch({ type: "reset", template: original ?? null });
    setErrors(null);
    setServerErrors([]);
  };

  const leave = () => {
    if (confirmLeave()) router.push(LIST_HREF);
  };

  const removeRoom = (key: string) => {
    const section = draft.sections.find((s) => s.key === key);
    if (!section) return;
    if (section.lines.length === 0) {
      dispatch({ type: "removeSection", key });
      return;
    }
    setRemoving({ key, title: section.title, lines: section.lines.length });
    setRemoveOpen(true);
  };

  const duplicateRoom = (key: string) => {
    const section = draft.sections.find((s) => s.key === key);
    if (!section) return;
    const newSectionKey = newKey("s");
    dispatch({
      type: "duplicateSection",
      key,
      newKey: newSectionKey,
      title: copyTitle(section.title, draft.sections.map((s) => s.title)),
      lineKeys: section.lines.map(() => newKey("l")),
    });
  };

  const saving = save.isPending;
  const saveButton = (
    <Button size="lg" onClick={() => void onSave()} disabled={saving || (!!original && !dirty)}>
      {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
      {saving ? "Saving…" : original ? "Save changes" : "Create template"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 pb-20 md:pb-0">
      <SetBreadcrumbs
        items={[
          { label: "Sales", href: "/app/sales" },
          { label: "Templates", href: LIST_HREF },
          { label: original ? original.name || "Template" : "New template" },
        ]}
      />
      <PageHeader
        title={original ? original.name || "Untitled template" : "New quote template"}
        description="Add the rooms a typical job has, and the usual lines in each. Quotes made from it can still be changed freely."
        actions={
          <div className="hidden items-center gap-2 md:flex">
            {original && dirty && (
              <Button variant="ghost" size="lg" onClick={discard} disabled={saving}>
                Discard changes
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={leave} disabled={saving}>
              {dirty ? "Cancel" : "Back"}
            </Button>
            {saveButton}
          </div>
        }
      />

      {serverErrors.length > 0 && (
        <Alert variant="destructive" aria-live="assertive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Couldn&apos;t save the template</AlertTitle>
          <AlertDescription>
            {serverErrors.length === 1 ? (
              serverErrors[0]
            ) : (
              <ul className="list-disc pl-4">
                {serverErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-md">
            <FormField id="template-name" label="Template name" error={shownErrors?.name}>
              <Input
                ref={nameRef}
                autoComplete="off"
                placeholder="e.g. Standard 3BHK"
                className="h-9"
                maxLength={TEMPLATE_LIMITS.name + 20}
                value={draft.name}
                onChange={(e) => dispatch({ type: "rename", name: e.target.value })}
                {...fieldAria("template-name", shownErrors?.name)}
              />
            </FormField>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-sm md:flex md:gap-6">
            <div>
              <dt className="text-xs text-muted-foreground">Rooms</dt>
              <dd className="font-medium tabular-nums text-ink">{draft.sections.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lines</dt>
              <dd className="font-medium tabular-nums text-ink">{lines}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">At today&apos;s rates</dt>
              <dd className="font-medium tabular-nums text-ink">{haveRates ? formatINR(estimate.total) : "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {haveRates && estimate.attention > 0 && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>
            {estimate.attention} {estimate.attention === 1 ? "line needs" : "lines need"} attention
          </AlertTitle>
          <AlertDescription>
            Their item was removed or deactivated on the rate card, or its option no longer exists. Edit or remove the
            flagged lines.
          </AlertDescription>
        </Alert>
      )}
      {catalogQuery.isError && !catalogQuery.data && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>Couldn&apos;t load the rate card</AlertTitle>
          <AlertDescription>You can rename and reorder rooms, but adding lines needs the rate card.</AlertDescription>
        </Alert>
      )}

      {draft.sections.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <h2 className="font-heading text-base font-semibold text-ink">Add the first room</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            For example a Modular Kitchen with base, wall and loft units, a Bedroom with a wardrobe, and Electrical work.
          </p>
          <Button className="mt-5" onClick={() => setRoomOpen(true)}>
            <Plus aria-hidden />
            Add room
          </Button>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Rooms">
          {draft.sections.map((section, index) => (
            <RoomCard
              key={section.key}
              section={section}
              index={index}
              count={draft.sections.length}
              catalogById={catalogById}
              haveRates={haveRates}
              subtotal={estimate.sections[section.key] ?? 0}
              titleError={shownErrors?.sections[section.key]}
              canAddLines={catalogQuery.isSuccess}
              dispatch={dispatch}
              onAddLine={() => openLine({ sectionKey: section.key, lineKey: null })}
              onEditLine={(lineKey) => openLine({ sectionKey: section.key, lineKey })}
              onRemove={() => removeRoom(section.key)}
              onDuplicate={() => duplicateRoom(section.key)}
            />
          ))}
        </ol>
      )}

      {draft.sections.length > 0 && (
        <div>
          <Button
            variant="outline"
            onClick={() => setRoomOpen(true)}
            disabled={draft.sections.length >= TEMPLATE_LIMITS.sections}
          >
            <Plus aria-hidden />
            Add room
          </Button>
        </div>
      )}

      {/* Phones: actions stay reachable at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Button variant="outline" size="lg" className="flex-1" onClick={leave} disabled={saving}>
          {dirty ? "Cancel" : "Back"}
        </Button>
        <div className="flex flex-1 [&>button]:w-full">{saveButton}</div>
      </div>

      <RoomDialog
        open={roomOpen}
        onOpenChange={setRoomOpen}
        suggestions={suggestions}
        onAdd={(title, type) => dispatch({ type: "addSection", key: newKey("s"), title, sectionType: type })}
      />

      <TemplateLineDialog
        open={lineOpen}
        onOpenChange={setLineOpen}
        sectionTitle={targetSection?.title ?? ""}
        sectionType={targetSection?.type ?? "component"}
        catalog={catalog}
        line={targetLine}
        onSave={(line) => {
          if (!lineTarget) return;
          if (lineTarget.lineKey) {
            dispatch({ type: "updateLine", sectionKey: lineTarget.sectionKey, lineKey: lineTarget.lineKey, line });
          } else {
            dispatch({ type: "addLine", sectionKey: lineTarget.sectionKey, line: { ...line, key: newKey("l") } });
          }
        }}
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{removing?.title || "this room"}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {removing?.lines} {removing?.lines === 1 ? "line goes" : "lines go"} too. Nothing is saved until you
              save the template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) dispatch({ type: "removeSection", key: removing.key });
                setRemoveOpen(false);
              }}
            >
              Remove room
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
