import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder cards for the updates feed. */
export function UpdatesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading updates">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          {i === 0 && <Skeleton className="aspect-[4/3] max-h-64 w-full rounded-lg" />}
        </div>
      ))}
    </div>
  );
}

/** Composer + feed placeholder for the page's Suspense fallback. */
export function UpdatesPageSkeleton({ withComposer = true }: { withComposer?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-28" />
      {withComposer && <Skeleton className="h-44 w-full rounded-xl" />}
      <UpdatesListSkeleton count={2} />
    </div>
  );
}
