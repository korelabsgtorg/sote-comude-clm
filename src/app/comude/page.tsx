import { Dashboard } from "@/components/(base)/dashboard";
import { getServerPortada } from "@/components/(base)/layout/actions";
import { getActividades } from "@/components/(comude)/actividades/lib/actions";
import { contarActividadesComude } from "@/components/(comude)/actividades/lib/actividadesPuntoActions";

export default async function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [initialPortada, initialActividades, initialActividadesCount] = await Promise.all([
    getServerPortada(),
    getActividades(currentYear, -1).catch(() => undefined),
    contarActividadesComude().catch(() => undefined),
  ]);

  return (
    <Dashboard
      initialPortada={initialPortada}
      initialActividades={initialActividades}
      initialActividadesYear={currentYear}
      initialActividadesCount={initialActividadesCount}
    />
  );
}
