"use client";

import { useId } from "react";
import { CATALOG_ITEM_TYPES, type CatalogItemType } from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "./catalog-model";

const HINTS: Record<CatalogItemType, string> = {
  component: "Per sq.ft",
  accessory: "Per unit",
  service: "Per UOM",
};

/** Component / accessory / service as a segmented control on native radios. */
export function TypeToggle({
  value,
  onChange,
  disabled,
  legend = "Type",
  disabledTypes = [],
}: {
  value: CatalogItemType;
  onChange: (type: CatalogItemType) => void;
  disabled?: boolean;
  legend?: string;
  /** Types that can't be chosen right now (still visible). */
  disabledTypes?: readonly CatalogItemType[];
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {CATALOG_ITEM_TYPES.map((type) => (
          <label
            key={type}
            className={cn(
              "flex min-w-0 cursor-pointer flex-col rounded-md px-2 py-1.5 transition-colors sm:px-3",
              "has-checked:bg-card has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              "has-disabled:cursor-not-allowed has-disabled:opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={type}
              checked={value === type}
              disabled={disabledTypes.includes(type)}
              onChange={() => onChange(type)}
              className="sr-only"
            />
            <span className="truncate text-sm font-medium text-ink">{TYPE_LABELS[type]}</span>
            <span className="truncate text-xs text-muted-foreground">{HINTS[type]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
