import { Skeleton } from "@/components/ui/skeleton";

const metricSkeletons = Array.from({ length: 4 }, (_, index) => index);
const rowSkeletons = Array.from({ length: 7 }, (_, index) => index);

export default function AdminLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading administration workspace"
    >
      <span className="sr-only">Loading workspace content.</span>

      <header className="flex flex-col gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {metricSkeletons.map((index) => (
          <div key={index} className="flex min-h-28 flex-col justify-between gap-4 rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border bg-background" aria-hidden="true">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-9 w-full max-w-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(7rem,1fr)_7rem_6rem] gap-4 border-b bg-muted/30 px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-12" />
          </div>
          {rowSkeletons.map((index) => (
            <div
              key={index}
              className="grid min-h-14 grid-cols-[minmax(0,2fr)_minmax(7rem,1fr)_7rem_6rem] items-center gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-2">
                <Skeleton className="h-4 w-full max-w-sm" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-24 max-w-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
      </section>
    </div>
  );
}
