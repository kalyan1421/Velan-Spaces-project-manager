"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { useId, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { NativeSelect } from "@/components/project/form/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import { SERVICE_UOMS, type CatalogItem, type ServiceUom } from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";
import { TYPE_LABELS, TYPE_PRICING_COPY, VARIANT_NOUN, VARIANT_PLACEHOLDER, rateUnit } from "./catalog-model";
import {
  CATALOG_LIMITS,
  EMPTY_VARIANT,
  catalogItemFormDefaults,
  catalogItemFormSchema,
  toCatalogItemBody,
  type CatalogItemFormValues,
} from "./catalog-schema";
import { useSaveCatalogItem } from "./queries";
import { TypeToggle } from "./type-toggle";

const UOM_LABELS: Record<ServiceUom, string> = {
  "Sq.Ft": "Sq.Ft (square feet)",
  Point: "Point",
  No: "No (each)",
  Rft: "Rft (running feet)",
};

/** Add or edit one rate card item. Closing is blocked while the save runs. */
export function CatalogItemDialog({
  open,
  onOpenChange,
  item,
  sectionOptions,
  usedInTemplates,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new item. */
  item: CatalogItem | null;
  /** Existing section labels, offered as suggestions. */
  sectionOptions: string[];
  /** How many quote templates use this item (edit only). */
  usedInTemplates: number;
  returnFocus: HTMLElement | null;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        finalFocus={() => (returnFocus?.isConnected ? returnFocus : true)}
      >
        {/* Keyed so each open starts from the item's saved values. */}
        <ItemForm
          key={item?.id ?? "new"}
          item={item}
          sectionOptions={sectionOptions}
          usedInTemplates={usedInTemplates}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({
  item,
  sectionOptions,
  usedInTemplates,
  onBusyChange,
  onDone,
}: {
  item: CatalogItem | null;
  sectionOptions: string[];
  usedInTemplates: number;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const id = useId();
  const listId = `${id}-sections`;
  const save = useSaveCatalogItem();
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const {
    register,
    control,
    handleSubmit,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CatalogItemFormValues>({
    resolver: zodResolver(catalogItemFormSchema),
    defaultValues: catalogItemFormDefaults(item),
    mode: "onTouched",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });
  const [itemType, uom] = useWatch({ control, name: ["itemType", "uom"] });
  const noun = VARIANT_NOUN[itemType];
  const unit = rateUnit(itemType, uom);
  const typeChanged = item !== null && item.itemType !== itemType;
  const busy = isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    setServerErrors([]);
    onBusyChange(true);
    try {
      const saved = await save.mutateAsync({ id: item?.id ?? null, body: toCatalogItemBody(values) });
      toast.success(item ? `Saved “${saved.name || values.name.trim()}”.` : `Added “${saved.name || values.name.trim()}” to the rate card.`);
      onDone();
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        setServerErrors(["This item no longer exists. It may have been deleted in another tab."]);
      } else {
        setServerErrors(isApiError(error) ? error.messages : ["Something went wrong. Please try again."]);
      }
    } finally {
      onBusyChange(false);
    }
  });

  const variantsError = errors.variants?.message ?? errors.variants?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{item ? `Edit “${item.name}”` : "Add rate card item"}</DialogTitle>
        <DialogDescription>{TYPE_PRICING_COPY[itemType]}</DialogDescription>
      </DialogHeader>

      {serverErrors.length > 0 && (
        <Alert variant="destructive" aria-live="assertive">
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

      <Controller
        control={control}
        name="itemType"
        render={({ field }) => (
          <TypeToggle
            value={field.value}
            disabled={busy}
            onChange={(next) => {
              field.onChange(next);
              clearErrors(["uom", "variants"]);
            }}
          />
        )}
      />
      {typeChanged && usedInTemplates > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-gold/15 px-3 py-2 text-xs text-ink">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Used in {usedInTemplates} {usedInTemplates === 1 ? "template" : "templates"} as a{" "}
            {TYPE_LABELS[item.itemType].toLowerCase()}. Those lines will be priced as a {TYPE_LABELS[itemType].toLowerCase()} when
            a quote is made from them.
          </span>
        </p>
      )}

      <FormField id={`${id}-name`} label="Name" error={errors.name?.message}>
        <Input
          autoComplete="off"
          placeholder={itemType === "component" ? "e.g. Kitchen Base Unit" : itemType === "accessory" ? "e.g. Soft-close hinge" : "e.g. Electrical point"}
          className="h-9"
          disabled={busy}
          maxLength={CATALOG_LIMITS.name + 20}
          {...fieldAria(`${id}-name`, errors.name?.message)}
          {...register("name")}
        />
      </FormField>

      <div className={cn("grid gap-4", itemType === "service" && "sm:grid-cols-2")}>
        <FormField
          id={`${id}-section`}
          label="Section (optional)"
          error={errors.defaultSection?.message}
          hint="Groups the rate card, e.g. Modular Kitchen."
        >
          <Input
            autoComplete="off"
            list={listId}
            placeholder="e.g. Modular Kitchen"
            className="h-9"
            disabled={busy}
            {...fieldAria(`${id}-section`, errors.defaultSection?.message, "hint")}
            {...register("defaultSection")}
          />
          <datalist id={listId}>
            {sectionOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </FormField>

        {itemType === "service" && (
          <FormField id={`${id}-uom`} label="Priced per" error={errors.uom?.message}>
            <NativeSelect
              className="h-9"
              disabled={busy}
              {...fieldAria(`${id}-uom`, errors.uom?.message)}
              {...register("uom")}
            >
              <option value="">Choose a unit…</option>
              {SERVICE_UOMS.map((u) => (
                <option key={u} value={u}>
                  {UOM_LABELS[u]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </div>

      <FormField id={`${id}-description`} label="Description (optional)" error={errors.description?.message}>
        <Textarea
          rows={2}
          placeholder="Shown under the item on quotes."
          disabled={busy}
          {...fieldAria(`${id}-description`, errors.description?.message)}
          {...register("description")}
        />
      </FormField>

      <fieldset className="flex min-w-0 flex-col gap-2" disabled={busy}>
        <legend className="mb-1 text-sm font-medium text-ink">
          {noun === "Brand" ? "Brands & prices" : `${noun}s & rates`}
        </legend>
        <p className="-mt-1 text-xs text-muted-foreground">
          {itemType === "accessory"
            ? "Add each brand you offer with its price per unit."
            : itemType === "component"
              ? "Add each finish or grade with its rate per sq.ft. The first one is the default."
              : "Add each option with its rate. The first one is the default."}
        </p>
        <ol className="flex flex-col gap-2">
          {fields.map((field, index) => {
            const labelError = errors.variants?.[index]?.label?.message;
            const rateError = errors.variants?.[index]?.rate?.message;
            const labelId = `${id}-v${index}-label`;
            const rateId = `${id}-v${index}-rate`;
            return (
              <li key={field.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <div className="min-w-0">
                  <label htmlFor={labelId} className="sr-only">
                    {noun} {index + 1} name
                  </label>
                  <Input
                    autoComplete="off"
                    placeholder={VARIANT_PLACEHOLDER[itemType]}
                    className="h-9"
                    {...fieldAria(labelId, labelError)}
                    {...register(`variants.${index}.label`)}
                  />
                </div>
                <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                  <label htmlFor={rateId} className="sr-only">
                    {noun} {index + 1} rate in rupees {unit}
                  </label>
                  <InputGroup className="h-9">
                    <InputGroupAddon>
                      <InputGroupText>₹</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      className="tabular-nums"
                      {...fieldAria(rateId, rateError)}
                      {...register(`variants.${index}.rate`)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{unit}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={fields.length === 1}
                  aria-label={`Remove ${noun.toLowerCase()} ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <X aria-hidden />
                </Button>
                {(labelError || rateError) && (
                  <div className="order-4 col-span-2 flex flex-col text-xs font-medium text-destructive sm:col-span-3">
                    {labelError && <p id={`${labelId}-error`}>{labelError}</p>}
                    {rateError && <p id={`${rateId}-error`}>{rateError}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {variantsError && <p className="text-xs font-medium text-destructive">{variantsError}</p>}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= CATALOG_LIMITS.variants}
            onClick={() => {
              append({ ...EMPTY_VARIANT });
              setTimeout(() => setFocus(`variants.${fields.length}.label`), 0);
            }}
          >
            <Plus aria-hidden />
            Add {noun.toLowerCase()}
          </Button>
        </div>
      </fieldset>

      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <label className="flex items-start justify-between gap-4 rounded-lg bg-muted/60 px-3 py-2.5 ring-1 ring-foreground/10">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Available for new quotes</span>
              <span className="block text-xs text-muted-foreground">
                Turn off to hide it from the quote builder without deleting it.
              </span>
            </span>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={busy} className="mt-1" />
          </label>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          {busy ? "Saving…" : item ? "Save changes" : "Add item"}
        </Button>
      </DialogFooter>
    </form>
  );
}
