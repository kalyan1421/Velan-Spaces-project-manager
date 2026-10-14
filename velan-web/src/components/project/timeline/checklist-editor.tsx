"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TIMELINE_LIMITS, type ChecklistItem } from "@/lib/api/project-ops";
import { FieldError, useEditor } from "./editor-context";
import { checklistFieldId } from "./timeline-editor";

function ChecklistRow({ phaseKey, taskKey, item }: { phaseKey: string; taskKey: string; item: ChecklistItem }) {
  const { dispatch, errors, disabled, announce } = useEditor();
  const fieldId = checklistFieldId(taskKey, item.id);
  const error = errors.get(fieldId);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Checkbox
          aria-label={`Done: ${item.label || "checklist item"}`}
          checked={item.isDone}
          disabled={disabled}
          onCheckedChange={(isDone) =>
            dispatch({ type: "updateChecklistItem", phaseKey, taskKey, itemId: item.id, patch: { isDone } })
          }
        />
        <Input
          id={fieldId}
          aria-label="Checklist item"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          value={item.label}
          maxLength={TIMELINE_LIMITS.checklistLabel}
          disabled={disabled}
          onChange={(e) =>
            dispatch({ type: "updateChecklistItem", phaseKey, taskKey, itemId: item.id, patch: { label: e.target.value } })
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove checklist item ${item.label}`}
          disabled={disabled}
          onClick={() => {
            dispatch({ type: "removeChecklistItem", phaseKey, taskKey, itemId: item.id });
            announce(`Removed checklist item ${item.label}.`);
          }}
        >
          <X />
        </Button>
      </div>
      <FieldError fieldId={fieldId} message={error} />
    </li>
  );
}

export function ChecklistEditor({ phaseKey, taskKey, items }: { phaseKey: string; taskKey: string; items: ChecklistItem[] }) {
  const { dispatch, disabled, newKey, announce } = useEditor();
  const [draft, setDraft] = useState("");
  const inputId = `task-${taskKey}-new-checklist`;
  const full = items.length >= TIMELINE_LIMITS.checklistItems;

  const add = () => {
    const label = draft.trim();
    if (!label || full) return;
    dispatch({ type: "addChecklistItem", phaseKey, taskKey, itemId: newKey(), label });
    announce(`Added checklist item ${label}.`);
    setDraft("");
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium text-ink">Checklist</legend>
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ChecklistRow key={item.id} phaseKey={phaseKey} taskKey={taskKey} item={item} />
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          New checklist item
        </label>
        <Input
          id={inputId}
          placeholder="Add a checklist item and press Enter"
          value={draft}
          maxLength={TIMELINE_LIMITS.checklistLabel}
          disabled={disabled || full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || full || !draft.trim()} onClick={add}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </div>
    </fieldset>
  );
}
