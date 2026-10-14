"use client";

import { Loader2, Search, UserPlus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { filterPeople, type Person } from "./workers-model";

/** Searchable multi-select of workers not yet on the project. */
export function AddWorkersDialog({
  available,
  pending,
  onAdd,
}: {
  available: Person[];
  pending: boolean;
  onAdd: (ids: string[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const searchId = useId();
  const visible = useMemo(() => filterPeople(available, query), [available, query]);

  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelected([]);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((s) => (checked ? [...new Set([...s, id])] : s.filter((x) => x !== id)));

  return (
    <Dialog open={open} onOpenChange={setOpenAndReset}>
      <DialogTrigger render={<Button size="lg" />}>
        <UserPlus data-icon="inline-start" />
        Add workers
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add workers</DialogTitle>
          <DialogDescription>Workers see this project, its timeline and the tasks assigned to them.</DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every active worker is already on this project. New worker accounts are created under Staff.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <label htmlFor={searchId} className="sr-only">
                Search workers
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, trade or phone"
                className="pl-8"
                autoComplete="off"
              />
            </div>
            <fieldset className="max-h-72 overflow-y-auto rounded-lg border">
              <legend className="sr-only">Workers</legend>
              {visible.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No workers match “{query.trim()}”.</p>
              ) : (
                <ul className="divide-y">
                  {visible.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <Checkbox checked={selected.includes(p.id)} onCheckedChange={(c) => toggle(p.id, c)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                          {(p.trade || p.phone) && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {[p.trade, p.phone].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            disabled={pending || selected.length === 0}
            onClick={async () => {
              if (await onAdd(selected)) setOpenAndReset(false);
            }}
          >
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
            {selected.length > 1 ? `Add ${selected.length} workers` : "Add worker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
