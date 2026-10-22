"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/** "1,250.5" → 1250.5; "" → null; anything else → NaN. */
export function parseNumberInput(text: string): number | null {
  const cleaned = text.replace(/[,\s₹%]/g, "");
  if (cleaned === "") return null;
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === ".") return Number.NaN;
  return Number(cleaned);
}

const show = (value: number | null) => (value === null || !Number.isFinite(value) ? "" : String(value));

const same = (a: number | null, b: number | null) =>
  Object.is(a, b) || (a !== null && b !== null && Math.abs(a - b) < 1e-9);

/**
 * Numeric text input that keeps what the user typed ("12.", "0.0") while
 * reporting a number on every change (`emptyValue` when cleared, NaN when
 * unparseable). Follows outside changes to `value` (e.g. a rate-card pick).
 */
export function NumberInput({
  value,
  onValueChange,
  emptyValue = null,
  onBlur,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "defaultValue"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Reported when the field is cleared (e.g. 0 for a discount). */
  emptyValue?: number | null;
}) {
  const [text, setText] = useState(show(value));
  const [seen, setSeen] = useState(value);
  const toValue = (t: string) => parseNumberInput(t) ?? emptyValue;

  // Adopt an external change unless the text already means that number.
  if (!Object.is(seen, value)) {
    setSeen(value);
    if (!same(toValue(text), value)) setText(show(value));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        const v = toValue(next);
        setText(next);
        setSeen(v);
        onValueChange(v);
      }}
      onBlur={(e) => {
        const parsed = parseNumberInput(text);
        if (parsed !== null && Number.isFinite(parsed)) setText(show(parsed));
        onBlur?.(e);
      }}
    />
  );
}
