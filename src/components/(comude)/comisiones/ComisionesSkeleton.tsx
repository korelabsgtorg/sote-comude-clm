import { Skeleton } from "@/components/ui/skeleton";

export function ComisionesHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 sm:gap-4 rounded-xl sm:rounded-2xl border bg-card p-3 sm:p-6 sm:flex-row sm:items-center sm:justify-between shadow-sm animate-pulse">
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <Skeleton className="size-9 sm:size-12 rounded-lg sm:rounded-xl shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-5 sm:h-7 w-48 sm:w-64 rounded-md" />
          <Skeleton className="hidden sm:block h-3.5 w-72 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Skeleton className="h-8 sm:h-9 w-full sm:w-56 rounded-lg sm:rounded-xl" />
        <Skeleton className="h-8 sm:h-9 w-24 rounded-lg sm:rounded-xl shrink-0" />
      </div>
    </div>
  );
}

export function ComisionesListSkeleton() {
  return (
    <div className="space-y-3">
      {/* Barra superior de conteo */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>

      {/* Carpetas de comisiones */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 p-3 sm:p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                <Skeleton className="size-9 sm:size-10 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-4 sm:h-5 w-4/5 sm:w-1/2 rounded-md" />
                  <Skeleton className="h-3 w-3/5 sm:w-1/3 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="hidden sm:block h-6 w-24 rounded-full" />
                <Skeleton className="size-5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComisionesPageSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-5 w-full">
      <ComisionesHeaderSkeleton />
      <ComisionesListSkeleton />
    </div>
  );
}

export function ActividadesSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border-l-[6px] border-l-slate-300 dark:border-l-neutral-700 border-t border-r border-b border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 sm:p-4 space-y-2.5 shadow-xs"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-4.5 w-20 rounded-md" />
                <Skeleton className="h-3.5 w-36 rounded" />
              </div>
              <Skeleton className="h-4.5 w-3/4 rounded-md" />
            </div>
            <Skeleton className="size-5 rounded shrink-0" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-48 rounded" />
            <Skeleton className="h-3.5 w-16 rounded shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetalleActividadSkeleton() {
  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-32 rounded" />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-4 w-40 rounded" />
            </div>
            <Skeleton className="h-6 w-3/4 rounded-md" />
          </div>
          <Skeleton className="size-7 rounded-lg" />
        </div>

        <div className="space-y-2 pt-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-neutral-800 space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50/50 dark:bg-neutral-800/40">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-3.5 flex-1 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
