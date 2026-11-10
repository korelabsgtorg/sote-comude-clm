"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActividadById } from "@/components/(comude)/actividades/lib/hooks";
import { ActComudeConParticipantes } from "@/components/(comude)/actividades/lib/zod";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import DetalleActividadView from "@/components/(comude)/actividades/DetalleActividadView";
import { getComudeUrl } from "@/components/(comude)/actividades/lib/slug";
import { Skeleton } from "@/components/ui/skeleton";

function DetalleSesionSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-full flex-1 flex flex-col relative min-h-[calc(100vh-100px)] animate-pulse">
      {/* 1. Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1.5 sm:px-6 py-3 border-b border-border/50 border-dashed bg-muted/10 gap-3 sm:gap-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-muted-foreground text-sm w-fit cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 18-6-6 6-6" />
          </svg>
          Volver
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-full" />
        </div>
      </div>

      {/* 2. Header Info (Grid de 2 columnas) */}
      <div className="px-1.5 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border/30">
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-5 w-4/5 sm:w-3/4 rounded-md" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-6">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-44 rounded" />
          </div>
        </div>
      </div>

      {/* 3. Banner Superior: Mi Asistencia */}
      <div className="px-1.5 sm:px-6 py-3">
        <p className="text-xs font-bold text-muted-foreground dark:text-gray-400 uppercase tracking-widest mb-2">
          Mi Asistencia
        </p>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3.5 w-40 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="size-8 rounded-full shrink-0" />
          </div>
        </div>
      </div>

      {/* 4. Tabs y Badges de Estado */}
      <div className="px-1.5 sm:px-6 py-2 border-b border-border/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Pestañas */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-500">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>

        {/* Píldoras de estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
      </div>

      {/* 5. Tabla de Puntos de Agenda */}
      <div className="px-1.5 sm:px-6 py-4 flex-1">
        {/* Desktop Table Skeleton */}
        <div className="hidden md:block w-full overflow-hidden border border-zinc-300 dark:border-zinc-700/80 rounded-md shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700 text-foreground dark:text-zinc-200 bg-muted/40 dark:bg-zinc-900/80 font-semibold">
                <th className="px-2 py-2.5 text-center w-8 border-r border-zinc-300 dark:border-zinc-700/70">#</th>
                <th className="px-2 py-2.5 text-center w-12 border-r border-zinc-300 dark:border-zinc-700/70">DOCS</th>
                <th className="px-3 py-2.5 text-left w-[24%] border-r border-zinc-300 dark:border-zinc-700/70">PUNTO A TRATAR</th>
                <th className="px-2 py-2.5 text-center w-36 border-r border-zinc-300 dark:border-zinc-700/70">ESTADO</th>
                <th className="px-2 py-2.5 text-center w-32 border-r border-zinc-300 dark:border-zinc-700/70">VOTACIÓN</th>
                <th className="px-3 py-2.5 text-center w-36 border-r border-zinc-300 dark:border-zinc-700/70">CATEGORÍA</th>
                <th className="px-3 py-2.5 text-left min-w-[200px] border-r border-zinc-300 dark:border-zinc-700/70">NOTAS</th>
                <th className="px-2 py-2.5 text-center w-36 border-r border-zinc-300 dark:border-zinc-700/70">ACTIVIDADES</th>
                <th className="px-2 py-2.5 text-center w-16">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {[1, 2, 3].map((row) => (
                <tr key={row} className="bg-card">
                  <td className="px-2 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-4 w-4 mx-auto rounded" />
                  </td>
                  <td className="px-2 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="size-4 mx-auto rounded" />
                  </td>
                  <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-4 w-4/5 rounded" />
                  </td>
                  <td className="px-2 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-6 w-24 mx-auto rounded-full" />
                  </td>
                  <td className="px-2 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-6 w-20 mx-auto rounded-full" />
                  </td>
                  <td className="px-3 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-4 w-16 mx-auto rounded" />
                  </td>
                  <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                  </td>
                  <td className="px-2 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <Skeleton className="h-6 w-24 mx-auto rounded-full" />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Skeleton className="size-4 mx-auto rounded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards Skeleton */}
        <div className="md:hidden flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-card p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-4/5 rounded" />
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ComudeDetalleClient({
  id,
  initialActividad,
}: {
  id: string;
  initialActividad?: ActComudeConParticipantes | null;
}) {
  const router = useRouter();
  const { user, effectiveRole } = useUserContext();
  const { data: actividad, isLoading, isError } = useActividadById(id, initialActividad);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (actividad?.id && actividad?.detalles_sesion?.titulo) {
      const fullUrl = getComudeUrl(actividad.id, actividad.detalles_sesion.titulo);
      window.history.replaceState(null, "", fullUrl);
    }
  }, [actividad]);

  const puedeGestionar = isSuperOrAdminRole(effectiveRole);

  const handleClose = () => {
    router.push("/comude");
  };

  if (!mounted) return null;

  if (isLoading) {
    return <DetalleSesionSkeleton onClose={handleClose} />;
  }

  if (isError || !actividad) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-destructive mb-4">No se pudo cargar la información del COMUDE o no existe.</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-muted text-foreground rounded-xl text-sm font-semibold hover:bg-muted/80"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col relative min-h-[calc(100vh-100px)]">
      <DetalleActividadView 
        actividad={actividad} 
        userId={user?.id} 
        effectiveRole={effectiveRole}
        puedeGestionar={puedeGestionar} 
        onClose={handleClose}
      />
    </div>
  );
}
