"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import type { ProjectStatusFilter } from "@/lib/projects";
import { cn } from "@/lib/utils";

const STATUSES: { value: ProjectStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

/** Search + status filter, mirrored into `?q=&status=` so views are shareable. */
export function ProjectsToolbar({ q, status }: { q: string; status: ProjectStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (next: { q?: string; status?: ProjectStatusFilter }) => {
    const params = new URLSearchParams();
    const nq = (next.q ?? text).trim();
    const ns = next.status ?? status;
    if (nq) params.set("q", nq);
    if (ns !== "all") params.set("status", ns);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        role="search"
        className="relative w-full sm:max-w-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          navigate({ q: text });
        }}
      >
        <label htmlFor="project-search" className="sr-only">
          Search projects
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="project-search"
          type="search"
          value={text}
          placeholder="Search name, code, client, location"
          className="h-9 bg-card pl-8"
          autoComplete="off"
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => navigate({ q: value }), 300);
          }}
        />
        {pending && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        )}
      </form>

      <div role="group" aria-label="Filter by status" className="inline-flex w-fit rounded-lg bg-muted p-0.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={status === s.value}
            onClick={() => navigate({ status: s.value })}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              status === s.value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
