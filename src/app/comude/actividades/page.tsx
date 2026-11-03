import { Suspense } from "react";
import GestorTareas from "@/components/(comude)/tareas/gestorTareas";
import { ActividadesPageSkeleton } from "@/components/(comude)/tareas/ActividadesSkeleton";

export const metadata = {
  title: "Mis Actividades | SOTE-COMUDE",
};

export default function MisActividadesPage() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 py-3 sm:p-6 lg:p-8">
      <Suspense fallback={<ActividadesPageSkeleton tipoVista="mis_actividades" />}>
        <GestorTareas tipoVista="mis_actividades" />
      </Suspense>
    </div>
  );
}
