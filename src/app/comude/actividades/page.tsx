import { Suspense } from "react";
import GestorTareas from "@/components/(comude)/tareas/gestorTareas";

export const metadata = {
  title: "Mis Actividades | SOTE-COMUDE",
};

export default function MisActividadesPage() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 py-3 sm:p-6 lg:p-8">
      <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando actividades...</div>}>
        <GestorTareas tipoVista="mis_actividades" />
      </Suspense>
    </div>
  );
}
