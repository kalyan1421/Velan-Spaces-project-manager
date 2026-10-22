"use client";

import { useId } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

/** Labelled single-choice select with an explicit "none" option (Base UI Select). */
export function OptionSelect({
  label,
  value,
  onChange,
  options,
  noneLabel,
  disabled,
  className,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: readonly Option[];
  /** Label of the empty choice; omit to require a value. */
  noneLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const items: { value: string | null; label: string }[] = [
    ...(noneLabel ? [{ value: null, label: noneLabel }] : []),
    ...options,
  ];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select<string | null>
        items={items}
        value={value}
        onValueChange={(v) => onChange(v ?? null)}
        disabled={disabled}
      >
        <SelectTrigger aria-labelledby={labelId} className="w-full min-w-0">
          <SelectValue placeholder={noneLabel ?? label} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((o) => (
              <SelectItem key={o.value ?? "__none"} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
