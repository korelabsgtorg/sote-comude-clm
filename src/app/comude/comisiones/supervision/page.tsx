import { Suspense } from "react";
import GestorComision from "@/components/(comude)/comisiones/GestorComision";
import { ComisionesPageSkeleton } from "@/components/(comude)/comisiones/ComisionesSkeleton";

export const metadata = {
  title: "Todas las Comisiones | SOTE-COMUDE",
};

export default function SupervisionComisionesPage() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-0.5 sm:px-6 py-2 sm:py-6 lg:p-8">
      <Suspense fallback={<ComisionesPageSkeleton />}>
        <GestorComision tipoVista="supervision" />
      </Suspense>
    </div>
  );
}
