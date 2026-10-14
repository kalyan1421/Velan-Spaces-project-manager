import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the portfolio list: header, filter chips, rows with thumbnails. */
export function PortfolioListSkeleton({ rows = 5, withHeader = true }: { rows?: number; withHeader?: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading portfolio">
      {withHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      )}
      <Skeleton className="h-9 w-full max-w-md" />
      <ol className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <Skeleton className="h-14 w-20 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
            <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
            <Skeleton className="size-8 shrink-0" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Placeholder for the editor: two columns of fields and a photo grid. */
export function PortfolioEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading editor">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
