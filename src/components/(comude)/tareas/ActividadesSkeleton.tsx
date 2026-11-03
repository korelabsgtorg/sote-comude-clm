import { Skeleton } from "@/components/ui/skeleton";

export function ActividadesPageSkeleton({
  tipoVista = "gestion_rrhh",
}: {
  tipoVista?: "mis_actividades" | "gestion_jefe" | "gestion_rrhh";
}) {
  const isAgrupado = tipoVista !== "mis_actividades";

  return (
    <div className="max-w-[1600px] w-full mx-auto px-1 sm:px-6 lg:px-8 flex flex-col gap-3 sm:gap-4 pb-20 mt-2 sm:mt-7 animate-pulse">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-center gap-3 sm:gap-4 text-center sm:text-left">
        <div className="space-y-1.5 flex flex-col items-center sm:items-start">
          <Skeleton className="h-8 w-56 sm:w-72 rounded-lg" />
          <Skeleton className="h-4 w-48 sm:w-80 rounded" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl shrink-0" />
      </div>

      {/* Barra de Filtros y Selectores */}
      <div className="flex flex-col gap-3.5 w-full mt-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 w-full">
          {/* Píldoras de Origen */}
          <div className="flex items-center gap-1.5 bg-white/90 dark:bg-neutral-900/90 p-1 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-xs h-10 w-full sm:w-auto overflow-hidden">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>

          {/* Toggle Mes / Rango + Selector */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 sm:w-36 rounded-xl" />
            <Skeleton className="h-9 w-32 sm:w-36 rounded-xl" />
          </div>
        </div>

        {/* Buscador */}
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>

      {/* Lista de Esqueletos (Dependencias o Tareas) */}
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-44 rounded" />
          {isAgrupado && <Skeleton className="h-4 w-24 rounded" />}
        </div>

        {[1, 2, 3].map((i) =>
          isAgrupado ? (
            <div
              key={i}
              className="border border-slate-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 shadow-sm p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="size-9 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-2/5 sm:w-1/3 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="size-5 rounded-full shrink-0" />
            </div>
          ) : (
            <div
              key={i}
              className="border border-slate-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 shadow-sm p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/2 rounded" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
