"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_PRESETS, DATE_PRESET_LABELS, type DatePreset, type DateRangeValue } from "./date-range";

const PRESET_ITEMS = DATE_PRESETS.map((value) => ({ value, label: DATE_PRESET_LABELS[value] }));

/** Preset picker; "Custom range" reveals From/To date inputs. */
export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void }) {
  const id = useId();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Select
          items={PRESET_ITEMS}
          value={value.preset}
          onValueChange={(next) => {
            const preset = (next ?? "all") as DatePreset;
            onChange(preset === "custom" ? { preset, from: value.from, to: value.to } : { preset, from: null, to: null });
          }}
        >
          <SelectPrimitive.Label className="text-xs font-medium text-muted-foreground">Date</SelectPrimitive.Label>
          <SelectTrigger className="h-9 min-w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRESET_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {value.preset === "custom" && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-from`} className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              id={`${id}-from`}
              type="date"
              value={value.from ?? ""}
              max={value.to ?? undefined}
              className="h-9 w-40 bg-card"
              onChange={(e) => onChange({ preset: "custom", from: e.target.value || null, to: value.to })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-to`} className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              id={`${id}-to`}
              type="date"
              value={value.to ?? ""}
              min={value.from ?? undefined}
              className="h-9 w-40 bg-card"
              onChange={(e) => onChange({ preset: "custom", from: value.from, to: e.target.value || null })}
            />
          </div>
        </>
      )}
    </div>
  );
}
