"use client";

import { useState, useRef } from "react";
import { CalendarDays, Plus, BookUser, Calendar, ListFilter } from "lucide-react";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import ListActividades from "./ListActividades";
import CalendarioComude from "./CalendarioComude";
import CrearComude from "./modals/CrearComude";
import DirectorioContactosModal from "./modals/DirectorioContactosModal";

interface GestorActividadesProps {
  userId?: string | null;
  effectiveRole: string;
}

export default function GestorActividades({ userId, effectiveRole }: GestorActividadesProps) {
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [modalContactosOpen, setModalContactosOpen] = useState(false);
  const [vistaPrincipal, setVistaPrincipal] = useState<'sesiones' | 'calendario'>('sesiones');
  const sectionRef = useRef<HTMLElement>(null);
  const puedeGestionar = isSuperOrAdminRole(effectiveRole);

  const handleToggleVista = () => {
    setVistaPrincipal((prev) => {
      const next = prev === 'sesiones' ? 'calendario' : 'sesiones';
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return next;
    });
  };

  return (
    <section ref={sectionRef} className="w-full scroll-mt-20 sm:scroll-mt-24">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-azul-trifinio shrink-0" />
          <h2 className="font-bold text-xl sm:text-2xl lg:text-3xl text-slate-800 dark:text-white tracking-tight">
            Sesiones <span className="text-azul-trifinio dark:text-celeste-trifinio">COMUDE</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center self-center sm:self-auto gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          
          {/* Botón Alternar Vista: Calendario / Sesiones */}
          <button
            onClick={handleToggleVista}
            className="col-span-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold border border-blue-500/50 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 bg-background dark:bg-card px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-500/10 dark:hover:bg-blue-500/20 shadow-xs transition-colors w-full sm:w-auto cursor-pointer"
          >
            {vistaPrincipal === 'sesiones' ? (
              <>
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Calendario</span>
              </>
            ) : (
              <>
                <ListFilter className="w-4 h-4 shrink-0" />
                <span>Sesiones</span>
              </>
            )}
          </button>

          {/* Botón Contactos — visible para todos los roles */}
          <button
            onClick={() => setModalContactosOpen(true)}
            className="col-span-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold border border-emerald-500/50 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-background dark:bg-card px-3 sm:px-4 py-2 rounded-lg hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 shadow-xs transition-colors w-full sm:w-auto cursor-pointer"
          >
            <BookUser className="w-4 h-4 shrink-0" />
            <span>Contactos</span>
          </button>

          {/* Botón Nuevo COMUDE — solo para admin/super: en móvil ocupa toda la fila */}
          {puedeGestionar && (
            <button
              onClick={() => setModalCrearOpen(true)}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold border border-azul-trifinio/60 text-azul-trifinio dark:text-celeste-trifinio bg-background dark:bg-card px-4 py-2 rounded-lg hover:bg-azul-trifinio/10 dark:hover:bg-azul-trifinio/20 shadow-xs transition-colors w-full sm:w-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nuevo COMUDE</span>
            </button>
          )}
        </div>
      </div>

      {/* Vista de Sesiones o Vista de Calendario */}
      {vistaPrincipal === 'sesiones' ? (
        <ListActividades 
          userId={userId}
          puedeGestionar={puedeGestionar}
          effectiveRole={effectiveRole}
          onCrearClick={() => setModalCrearOpen(true)}
        />
      ) : (
        <CalendarioComude
          userId={userId}
          puedeGestionar={puedeGestionar}
          effectiveRole={effectiveRole}
          onCrearClick={() => setModalCrearOpen(true)}
        />
      )}

      {/* Modal de creación */}
      <CrearComude
        isOpen={modalCrearOpen}
        onClose={() => setModalCrearOpen(false)}
        actorRole={effectiveRole}
      />

      {/* Modal de directorio de contactos */}
      <DirectorioContactosModal
        isOpen={modalContactosOpen}
        onClose={() => setModalContactosOpen(false)}
        effectiveRole={effectiveRole}
        userId={userId}
      />
    </section>
  );
}
