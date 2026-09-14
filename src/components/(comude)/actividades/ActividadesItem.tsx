"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronRight, ChevronUp, Edit2, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ActComudeConParticipantes } from "./lib/zod";
import { useEliminarActividad } from "./lib/hooks";
import Swal from "sweetalert2";
import CrearComude from "./modals/CrearComude";

interface ActividadesItemProps {
  actividad: ActComudeConParticipantes;
  userId?: string | null;
  puedeGestionar: boolean;
  effectiveRole: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function formatFecha(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const diaName = dias[fecha.getDay()];
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString().slice(-2);
  let hours = fecha.getHours();
  const minutes = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${diaName} ${d}/${m}/${y} a las ${hours}:${minutes} ${ampm}`;
}

function esHoy(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

function diasRestantes(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ActividadesItem({
  actividad,
  userId,
  puedeGestionar,
  effectiveRole,
  isExpanded,
  onToggle,
}: ActividadesItemProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const { mutateAsync: eliminarActividad } = useEliminarActividad();

  const hoy = esHoy(actividad.fecha);
  const dias = diasRestantes(actividad.fecha);

  const handleEliminar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "Eliminar Actividad",
      text: `Se eliminará permanentemente la actividad "${actividad.detalles_sesion?.titulo || "Sin título"}". Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await eliminarActividad(actividad.id);
        Swal.fire('¡Eliminado!', 'La actividad ha sido eliminada.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Hubo un problema al eliminar la actividad.', 'error');
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl border bg-white/70 dark:bg-white/5 backdrop-blur-sm shadow-sm overflow-hidden relative",
          hoy
            ? "border-azul-trifinio/40 ring-1 ring-azul-trifinio/20"
            : "border-white/30 dark:border-white/10"
        )}
      >
        {/* Línea azul lateral */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1a73e8]" />

        <div 
          onClick={onToggle}
          className="w-full group flex flex-col cursor-pointer focus:outline-none"
        >
          {/* Cabecera Clickable */}
          <div className="flex items-center justify-between gap-3 p-4 pl-5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* Fila 1: Título y Fecha */}
              <p className="text-[15px] truncate">
                <span className="font-bold text-foreground">
                  {actividad.detalles_sesion?.titulo || "Sin título"}
                </span>
                <span className="text-muted-foreground ml-2">
                  {formatFecha(actividad.fecha)}
                </span>
              </p>

              {/* Fila 2: Acta y Libro */}
              <p className="text-sm font-medium text-foreground/80 uppercase">
                {actividad.detalles_sesion?.acta ? `ACTA ${actividad.detalles_sesion.acta}` : ""}
                {actividad.detalles_sesion?.acta && actividad.detalles_sesion?.libro ? ", " : ""}
                {actividad.detalles_sesion?.libro ? `LIBRO ${actividad.detalles_sesion.libro}` : ""}
                {!actividad.detalles_sesion?.acta && !actividad.detalles_sesion?.libro ? "Sin acta/libro asignado" : ""}
              </p>

              {/* Fila 3: Estado y Días */}
              <div className="flex items-center text-[13px]">
                <span className="font-bold text-[#1a73e8] dark:text-blue-400">En preparación</span>
                <span className="text-foreground font-medium">
                  {hoy ? ", Hoy" : dias > 0 ? `, ${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}` : ""}
                </span>
              </div>
            </div>

            {/* Chevron de Expansión */}
            <div className="p-2 text-muted-foreground/50 group-hover:text-azul-trifinio transition-colors">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          </div>

          {/* Action Bar Expandible */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/50 bg-black/5 dark:bg-black/20 p-3 pl-5 flex items-center justify-between">
                  {/* Izquierda: Eliminar (solo si tiene permisos) */}
                  <div>
                    {puedeGestionar && (
                      <button
                        onClick={handleEliminar}
                        className="flex items-center gap-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    )}
                  </div>

                  {/* Derecha: Editar y Entrar */}
                  <div className="flex items-center gap-2">
                    {puedeGestionar && (
                      <button
                        onClick={handleEdit}
                        className="flex items-center gap-1.5 text-sm font-semibold text-[#1a73e8] dark:text-blue-400 hover:bg-[#1a73e8]/10 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Editar
                      </button>
                    )}
                    <Link
                      href={`/comude/comude/${actividad.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Entrar
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Modal Editar */}
      {isEditModalOpen && (
        <CrearComude
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          actorRole={effectiveRole}
          actividad={actividad}
        />
      )}
    </>
  );
}
