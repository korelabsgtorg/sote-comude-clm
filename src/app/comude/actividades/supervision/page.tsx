import { Suspense } from "react";
import GestorTareas from "@/components/(comude)/tareas/gestorTareas";
import { ActividadesPageSkeleton } from "@/components/(comude)/tareas/ActividadesSkeleton";

export const metadata = {
  title: "Actividades Globales | SOTE-COMUDE",
};

export default function GestionSupervisionPage() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 py-3 sm:p-6 lg:p-8">
      <Suspense fallback={<ActividadesPageSkeleton tipoVista="gestion_rrhh" />}>
        <GestorTareas tipoVista="gestion_rrhh" />
      </Suspense>
    </div>
  );
}
