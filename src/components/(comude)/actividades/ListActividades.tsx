"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, CalendarDays, ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarClock, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActividades } from "./lib/hooks";
import ActividadesItem from "./ActividadesItem";
import MonthPicker from "./modals/MonthPicker";

interface ListActividadesProps {
  userId?: string | null;
  puedeGestionar: boolean;
  effectiveRole: string;
  onCrearClick: () => void;
}

type VistaType = 'hoy' | 'proximas' | 'terminadas';

function diasRestantes(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ListActividades({ userId, puedeGestionar, effectiveRole, onCrearClick }: ListActividadesProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [vista, setVista] = useState<VistaType>('hoy');
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: actividades, isLoading, isError, refetch } = useActividades(year, month);

  // Calcular counts y filtrar por vista
  const actividadesFiltradas = useMemo(() => {
    return (actividades || [])
      .filter((act) => {
        const titulo = act.detalles_sesion?.titulo || "";
        const searchMatch = titulo.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!searchMatch) return false;
        
        const dias = diasRestantes(act.fecha);
        if (vista === 'hoy' && dias !== 0) return false;
        if (vista === 'proximas' && dias <= 0) return false;
        if (vista === 'terminadas' && dias >= 0) return false;
        
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.fecha).getTime();
        const dateB = new Date(b.fecha).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
  }, [actividades, searchQuery, vista, sortOrder]);

  const counts = useMemo(() => {
    let hoy = 0;
    let proximas = 0;
    let terminadas = 0;
    (actividades || []).forEach(a => {
      const dias = diasRestantes(a.fecha);
      if (dias === 0) hoy++;
      else if (dias > 0) proximas++;
      else if (dias < 0) terminadas++;
    });
    return { hoy, proximas, terminadas };
  }, [actividades]);

  useEffect(() => {
    if (!isLoading && !hasAutoSelected && actividades) {
      if (counts.hoy > 0) setVista('hoy');
      else if (counts.proximas > 0) setVista('proximas');
      else if (counts.terminadas > 0) setVista('terminadas');
      setHasAutoSelected(true);
    }
  }, [isLoading, hasAutoSelected, actividades, counts]);

  // Reset auto-select flag when month/year changes
  useEffect(() => {
    setHasAutoSelected(false);
  }, [year, month]);

  return (
    <div className="space-y-6">
      {/* Controles de Filtro */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-azul-trifinio/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none">
            <MonthPicker
              year={year}
              month={month}
              onChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
            />
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center justify-center w-10 h-10 shrink-0 bg-black/5 dark:bg-black/20 border border-border/50 rounded-xl hover:bg-black/10 dark:hover:bg-black/30 transition-colors text-muted-foreground hover:text-foreground"
            title={sortOrder === 'desc' ? "Ordenar ascendentemente" : "Ordenar descendentemente"}
          >
            {sortOrder === 'desc' ? <ArrowDownWideNarrow size={18} /> : <ArrowUpNarrowWide size={18} />}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="w-full min-w-0 border-t border-border/50 pt-2 xl:border-none xl:pt-0">
        <div className="flex items-center gap-1 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 xl:overflow-x-visible">
          {(counts.hoy > 0 || vista === 'hoy') && (
            <button onClick={() => setVista('hoy')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'hoy' ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground")}>
              <CalendarClock className="h-4 w-4" /> <span>Hoy ({counts.hoy})</span>
              {vista === 'hoy' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 dark:bg-blue-400" />}
            </button>
          )}
          
          {(counts.proximas > 0 || vista === 'proximas') && (
            <button onClick={() => setVista('proximas')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'proximas' ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:text-foreground")}>
              <CalendarDays className="h-4 w-4" /> <span>Próximas ({counts.proximas})</span>
              {vista === 'proximas' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400" />}
            </button>
          )}

          {(counts.terminadas > 0 || vista === 'terminadas') && (
            <button onClick={() => setVista('terminadas')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'terminadas' ? "text-red-600 dark:text-red-400" : "text-muted-foreground hover:text-foreground")}>
              <CalendarCheck className="h-4 w-4" /> <span>Terminadas ({counts.terminadas})</span>
              {vista === 'terminadas' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-600 dark:bg-red-400" />}
            </button>
          )}
        </div>
      </div>

      {/* Estados de carga / error / vacío */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="text-center py-6 text-sm text-destructive">
          Error al cargar las actividades.
          <button onClick={() => refetch()} className="ml-1 underline">
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && actividadesFiltradas.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8 text-muted-foreground text-sm"
        >
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>
            {searchQuery 
              ? "No se encontraron actividades con esa búsqueda." 
              : "No hay actividades registradas en este mes."}
          </p>
          {puedeGestionar && (
            <button
              onClick={onCrearClick}
              className="mt-3 text-azul-trifinio font-semibold underline underline-offset-2 text-xs"
            >
              Crear primera actividad
            </button>
          )}
        </motion.div>
      )}

      {/* Lista */}
      {!isLoading && !isError && actividadesFiltradas.length > 0 && (
        <div className="space-y-2.5">
          {actividadesFiltradas.map((act) => (
            <ActividadesItem
              key={act.id}
              actividad={act}
              userId={userId}
              puedeGestionar={puedeGestionar}
              effectiveRole={effectiveRole}
              isExpanded={expandedId === act.id}
              onToggle={() => setExpandedId(expandedId === act.id ? null : act.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
