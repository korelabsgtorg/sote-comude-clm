import ComudeDetalleClient from "./ComudeDetalleClient";
import { getActividadById } from "@/components/(comude)/actividades/lib/actions";

export default async function ComudeDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialActividad = await getActividadById(id).catch(() => undefined);
  return <ComudeDetalleClient id={id} initialActividad={initialActividad} />;
}
