"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { useFieldArray, type Control, type FieldErrors, type UseFormGetValues, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SETTINGS_LIMITS, type SettingsFormValues } from "./settings-schema";

/** The default "Not included" list printed on quotes: add, edit, reorder, remove. */
export function NotIncludedEditor({
  control,
  register,
  getValues,
  errors,
  disabled,
}: {
  control: Control<SettingsFormValues>;
  register: UseFormRegister<SettingsFormValues>;
  getValues: UseFormGetValues<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  disabled?: boolean;
}) {
  const id = useId();
  const { fields, append, remove, swap } = useFieldArray({ control, name: "defaultNotIncluded" });
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const full = fields.length >= SETTINGS_LIMITS.notIncludedItems;
  const listError = errors.defaultNotIncluded?.message ?? errors.defaultNotIncluded?.root?.message;

  const add = () => {
    const text = draft.trim();
    if (!text) {
      setDraftError("Type an item first.");
      return;
    }
    if (text.length > SETTINGS_LIMITS.notIncludedItem) {
      setDraftError(`Keep it under ${SETTINGS_LIMITS.notIncludedItem} characters.`);
      return;
    }
    if (getValues("defaultNotIncluded").some((v) => v.value.trim().toLowerCase() === text.toLowerCase())) {
      setDraftError("This is already in the list.");
      return;
    }
    append({ value: text }, { shouldFocus: false });
    setDraft("");
    setDraftError(null);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-ink">Not included (default list)</legend>
      <p className="-mt-1 text-xs text-muted-foreground">
        Printed on every new quote under “Not included”. Each quote can still change its own list.
      </p>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">Nothing listed yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {fields.map((field, index) => {
            const inputId = `${id}-item-${index}`;
            const error = errors.defaultNotIncluded?.[index]?.value?.message;
            return (
              <li key={field.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span aria-hidden className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <label htmlFor={inputId} className="sr-only">
                    Item {index + 1}
                  </label>
                  <Input
                    id={inputId}
                    autoComplete="off"
                    className="h-9 min-w-0 flex-1"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    {...register(`defaultNotIncluded.${index}.value`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move item ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => swap(index, index - 1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move item ${index + 1} down`}
                    disabled={index === fields.length - 1}
                    onClick={() => swap(index, index + 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                {error && (
                  <p id={`${inputId}-error`} className="pl-7 text-xs font-medium text-destructive">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {listError && <p className="text-xs font-medium text-destructive">{listError}</p>}

      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <label htmlFor={`${id}-new`} className="sr-only">
            New item
          </label>
          <Input
            id={`${id}-new`}
            value={draft}
            autoComplete="off"
            placeholder="e.g. Loose furniture"
            className="h-9 min-w-0 flex-1"
            disabled={full}
            aria-invalid={draftError ? true : undefined}
            aria-describedby={draftError ? `${id}-new-error` : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" className="h-9" onClick={add} disabled={full}>
            <Plus aria-hidden />
            Add
          </Button>
        </div>
        {draftError && (
          <p id={`${id}-new-error`} className="text-xs font-medium text-destructive">
            {draftError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
