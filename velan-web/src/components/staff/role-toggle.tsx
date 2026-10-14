"use client";

import { useId } from "react";
import type { StaffRole } from "@/lib/api/accounts";
import { cn } from "@/lib/utils";

const OPTIONS: { value: StaffRole; label: string; hint: string }[] = [
  { value: "worker", label: "Worker", hint: "Signs in with a username" },
  { value: "manager", label: "Manager", hint: "Signs in with an email" },
];

/** Two-option segmented control built on native radios (keyboard + screen-reader friendly). */
export function RoleToggle({
  value,
  onChange,
  disabled,
}: {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">Role</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer flex-col rounded-md px-3 py-2 transition-colors",
              "has-checked:bg-card has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              "has-disabled:cursor-not-allowed has-disabled:opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="text-sm font-medium text-ink">{o.label}</span>
            <span className="text-xs text-muted-foreground">{o.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
