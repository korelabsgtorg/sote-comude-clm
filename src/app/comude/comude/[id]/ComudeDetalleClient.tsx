"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActividadById } from "@/components/(comude)/actividades/lib/hooks";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import DetalleActividadView from "@/components/(comude)/actividades/DetalleActividadView";
import { Loader2 } from "lucide-react";

export default function ComudeDetalleClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, effectiveRole } = useUserContext();
  const { data: actividad, isLoading, isError } = useActividadById(id);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const puedeGestionar = isSuperOrAdminRole(effectiveRole);

  const handleClose = () => {
    router.push("/comude");
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-azul-trifinio mb-4" />
        <p className="text-muted-foreground">Cargando detalles del COMUDE...</p>
      </div>
    );
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
