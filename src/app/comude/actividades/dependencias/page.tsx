import { Suspense } from "react";
import GestorTareas from "@/components/(comude)/tareas/gestorTareas";

export const metadata = {
  title: "Actividades Globales | SOTE-COMUDE",
};

export default function ActividadesDependenciasPage() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 py-3 sm:p-6 lg:p-8">
      <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando actividades por dependencia...</div>}>
        <GestorTareas tipoVista="gestion_rrhh" />
      </Suspense>
    </div>
  );
}
