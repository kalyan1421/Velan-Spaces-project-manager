"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { createContext, use, type Dispatch } from "react";
import { Button } from "@/components/ui/button";
import type { EditorAction } from "./timeline-editor";

export type Option = { id: string; name: string };

export type EditorContextValue = {
  dispatch: Dispatch<EditorAction>;
  /** fieldId → message, from the last save attempt. */
  errors: ReadonlyMap<string, string>;
  workers: Option[];
  rooms: Option[];
  phaseOptions: { key: string; name: string }[];
  /** Polite screen-reader announcement (reorders, adds, removes). */
  announce: (message: string) => void;
  /** Focus a field after the next render (e.g. the title of a task just added). */
  focusAfterRender: (fieldId: string) => void;
  newKey: () => string;
  disabled: boolean;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorProvider = EditorContext;

export function useEditor(): EditorContextValue {
  const ctx = use(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside <EditorProvider>");
  return ctx;
}

/** aria wiring for a control with an optional editor error. */
export function useFieldA11y(fieldId: string) {
  const { errors } = useEditor();
  const error = errors.get(fieldId);
  return {
    error,
    props: {
      id: fieldId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${fieldId}-error` : undefined,
    } as const,
  };
}

export function FieldError({ fieldId, message }: { fieldId: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${fieldId}-error`} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/**
 * Keyboard-accessible up/down reorder buttons (drag is optional; these always work).
 * When a move reaches the first/last slot the pressed button becomes disabled, so
 * focus is handed to the other button instead of being dropped on <body>.
 */
export function ReorderButtons({
  idBase,
  label,
  index,
  count,
  onMove,
}: {
  idBase: string;
  label: string;
  index: number;
  count: number;
  onMove: (offset: -1 | 1) => void;
}) {
  const { focusAfterRender, disabled } = useEditor();
  const move = (offset: -1 | 1) => {
    const next = index + offset;
    onMove(offset);
    if (next === 0) focusAfterRender(`${idBase}-down`);
    else if (next === count - 1) focusAfterRender(`${idBase}-up`);
  };
  return (
    <div className="flex items-center gap-0.5">
      <Button
        id={`${idBase}-up`}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${label} up`}
        disabled={disabled || index === 0}
        onClick={() => move(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        id={`${idBase}-down`}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${label} down`}
        disabled={disabled || index === count - 1}
        onClick={() => move(1)}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
