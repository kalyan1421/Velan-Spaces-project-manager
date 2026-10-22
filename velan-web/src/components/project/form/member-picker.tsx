"use client";

import { Search } from "lucide-react";
import { useId, useState, type Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickerPerson = { id: string; name: string; detail?: string | null; suspended?: boolean };

const SEARCH_THRESHOLD = 6;

/**
 * Searchable checkbox list for project members. A suspended account can be
 * unticked but not newly ticked. `fieldRef` lets react-hook-form focus the
 * group when it has a validation error.
 */
export function MemberPicker({
  legend,
  description,
  people,
  value,
  onChange,
  error,
  emptyText,
  fieldRef,
}: {
  legend: string;
  description?: string;
  people: PickerPerson[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  emptyText: string;
  fieldRef?: Ref<HTMLFieldSetElement>;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const q = query.trim().toLowerCase();
  const visible = q
    ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.detail ?? "").toLowerCase().includes(q))
    : people;
  const describedBy = [description ? `${id}-desc` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  const toggle = (personId: string, checked: boolean) =>
    onChange(checked ? [...value.filter((v) => v !== personId), personId] : value.filter((v) => v !== personId));

  return (
    <fieldset ref={fieldRef} tabIndex={-1} aria-describedby={describedBy} className="flex flex-col gap-2 outline-none">
      <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium text-ink">
        {legend}
        <span className="text-xs font-normal text-muted-foreground">{value.length} selected</span>
      </legend>
      {description && (
        <p id={`${id}-desc`} className="-mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className={cn("rounded-lg border", error && "border-destructive")}>
          {people.length > SEARCH_THRESHOLD && (
            <div className="relative border-b p-2">
              <label htmlFor={`${id}-search`} className="sr-only">
                Search {legend.toLowerCase()}
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id={`${id}-search`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or trade"
                className="pl-8"
                autoComplete="off"
              />
            </div>
          )}
          <ul className="max-h-60 divide-y overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No one matches “{query.trim()}”.</li>
            ) : (
              visible.map((p) => {
                const checked = selected.has(p.id);
                const locked = Boolean(p.suspended) && !checked;
                return (
                  <li key={p.id}>
                    <label
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5",
                        locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50",
                      )}
                    >
                      <Checkbox checked={checked} disabled={locked} onCheckedChange={(c) => toggle(p.id, c)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{p.name}</span>
                        {p.detail && <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>}
                      </span>
                      {p.suspended && <Badge variant="destructive">Suspended</Badge>}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
