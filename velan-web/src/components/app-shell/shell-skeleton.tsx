import { Skeleton } from "@/components/ui/skeleton";

/** Static shell shown while the session is checked (prerendered with Cache Components). */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="hidden w-60 shrink-0 bg-sidebar md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <Skeleton className="h-4 w-32" />
          <div className="flex-1" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="px-4 py-6 md:px-6 lg:px-8">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

/** Generic content placeholder: header + rows. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TopBarSkeleton() {
  return (
    <div className="flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6" aria-busy="true">
      <Skeleton className="size-8 rounded-lg" />
      <Skeleton className="h-4 w-32" />
      <div className="flex-1" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}
