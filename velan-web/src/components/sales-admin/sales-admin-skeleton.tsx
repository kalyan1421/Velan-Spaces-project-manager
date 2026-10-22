import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

/** Rate card / templates list: header, toolbar, grouped rows. */
export function ListSkeleton({ rows = 6, withHeader = true }: { rows?: number; withHeader?: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      {withHeader && <HeaderSkeleton />}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
            <Skeleton className="hidden h-5 w-40 sm:block" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Template editor: name field and two room cards. */
export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading editor">
      <HeaderSkeleton />
      <Skeleton className="h-9 w-full max-w-md" />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Settings: stacked cards of fields. */
export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading settings">
      <HeaderSkeleton action={false} />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-5 w-36" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}
