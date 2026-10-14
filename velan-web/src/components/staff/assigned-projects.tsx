"use client";

import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { assignedProjectNames } from "@/lib/api/accounts";
import { cn } from "@/lib/utils";

/** "3 projects" with a popover listing their names (ids resolved against the head's project list). */
export function AssignedProjects({
  ids,
  projectNames,
  personName,
}: {
  ids: readonly string[] | undefined;
  projectNames: Readonly<Record<string, string>>;
  personName: string;
}) {
  const count = ids?.length ?? 0;
  if (count === 0) return <span className="text-sm text-muted-foreground">None</span>;

  const { names, unknown } = assignedProjectNames(ids, projectNames);
  const label = `${count} ${count === 1 ? "project" : "projects"}`;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${label} for ${personName}`}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-medium text-ink tabular-nums outline-none transition-colors",
          "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
        )}
      >
        {label}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{personName}&apos;s projects</PopoverTitle>
        </PopoverHeader>
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {names.map((name, i) => (
            <li key={`${name}-${i}`} className="truncate text-sm text-ink">
              {name}
            </li>
          ))}
          {unknown > 0 && (
            <li className="text-sm text-muted-foreground">
              {unknown} {unknown === 1 ? "project" : "projects"} not in your list
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
