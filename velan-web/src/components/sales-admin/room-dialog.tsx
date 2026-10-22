"use client";

import { useId, useState } from "react";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
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
import type { CatalogItemType } from "@/lib/api/sales-types";
import { TYPE_PLURALS } from "./catalog-model";
import { TEMPLATE_LIMITS, sectionTitleProblem } from "./template-editor-model";
import { TypeToggle } from "./type-toggle";

/** "Add room": a title and the kind of lines it holds. */
export function RoomDialog({
  open,
  onOpenChange,
  suggestions,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Section labels from the rate card, per type. */
  suggestions: Record<CatalogItemType, string[]>;
  onAdd: (title: string, type: CatalogItemType) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The popup unmounts once closed, so each opening starts empty. */}
        <RoomForm
          suggestions={suggestions}
          onCancel={() => onOpenChange(false)}
          onAdd={(title, type) => {
            onAdd(title, type);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RoomForm({
  suggestions,
  onCancel,
  onAdd,
}: {
  suggestions: Record<CatalogItemType, string[]>;
  onCancel: () => void;
  onAdd: (title: string, type: CatalogItemType) => void;
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CatalogItemType>("component");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = sectionTitleProblem(title);
        if (problem) {
          setError(problem);
          return;
        }
        onAdd(title.trim(), type);
      }}
    >
      <DialogHeader>
        <DialogTitle>Add room or section</DialogTitle>
        <DialogDescription>Each room holds one kind of line, so the quote shows the right columns.</DialogDescription>
      </DialogHeader>

      <FormField id={`${id}-title`} label="Name" error={error ?? undefined}>
        <Input
          autoFocus
          autoComplete="off"
          list={`${id}-suggestions`}
          placeholder="e.g. Modular Kitchen, Master Bedroom"
          className="h-9"
          maxLength={TEMPLATE_LIMITS.sectionTitle + 10}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          {...fieldAria(`${id}-title`, error ?? undefined)}
        />
        <datalist id={`${id}-suggestions`}>
          {suggestions[type].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </FormField>

      <TypeToggle value={type} onChange={setType} legend="Holds" />
      <p className="-mt-2 text-xs text-muted-foreground">
        Lines are picked from {TYPE_PLURALS[type].toLowerCase()} on the rate card.
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg">
          Add room
        </Button>
      </DialogFooter>
    </form>
  );
}
