"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Building2,
  ChevronDown,
  Search,
  X,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useUser, useUserContext } from "@/components/(base)/providers/UserProvider";
import { useMisComisiones, useTodasComisiones } from "./lib/hooks";
import { ComisionList } from "./ComisionList";
import { ComisionesListSkeleton, DetalleActividadSkeleton } from "./ComisionesSkeleton";
import { useActividadesDeComision } from "../tareas/lib/hooks";
import TareaItem from "../tareas/TareaItem";
import type { Usuario } from "../tareas/lib/zod";
import type { MiComisionRecord } from "./lib/zod";

interface DetalleActividadComisionProps {
  comision: MiComisionRecord;
  año: number;
  tareaId: string;
  onVolver: () => void;
  esSupervision?: boolean;
  currentUserId?: string;
}

function DetalleActividadComision({
  comision,
  año,
  tareaId,
  onVolver,
  esSupervision = false,
  currentUserId,
}: DetalleActividadComisionProps) {
  const { user, effectiveRole } = useUserContext();
  const usuarioActualId = user?.id || currentUserId || "";
  const esSuper = effectiveRole === "super";
  const esMiembro =
    !esSupervision ||
    Boolean(
      usuarioActualId &&
        comision.integrantes?.some((i) => i.id_integrante === usuarioActualId),
    );
  const puedeGestionar = esSuper || esMiembro;

  const { data: dataActividades, isLoading } = useActividadesDeComision(
    comision.id,
    año,
  );

  const usuariosAsignables = useMemo<Usuario[]>(() => {
    if (dataActividades?.usuarios && dataActividades.usuarios.length > 0) {
      return dataActividades.usuarios;
    }
    return (comision.integrantes ?? []).map((int) => ({
      user_id: int.id_integrante,
      nombre: int.nombre || "Integrante",
      activo: true,
      esjefe: false,
      rol: int.rol,
      oficina_nombre: comision.nombre,
    }));
  }, [dataActividades?.usuarios, comision.integrantes, comision.nombre]);

  const nombreUsuarioActual = useMemo(() => {
    const enIntegrantes = comision.integrantes?.find(
      (i) => i.id_integrante === usuarioActualId,
    )?.nombre;
    if (enIntegrantes) return enIntegrantes;
    const enUsuarios = usuariosAsignables.find(
      (u) => u.user_id === usuarioActualId,
    )?.nombre;
    return (
      enUsuarios ||
      (user?.user_metadata?.nombre as string | undefined) ||
      "Usuario"
    );
  }, [comision.integrantes, usuariosAsignables, usuarioActualId, user]);

  const tarea = dataActividades?.tareas?.find((t) => t.id === tareaId);

  useEffect(() => {
    if (
      !isLoading &&
      dataActividades &&
      !dataActividades.tareas.some((t) => t.id === tareaId)
    ) {
      onVolver();
    }
  }, [isLoading, dataActividades, tareaId, onVolver]);

  if (isLoading) {
    return <DetalleActividadSkeleton />;
  }

  if (!tarea) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground space-y-2">
        <p>No se encontró la actividad seleccionada o fue eliminada.</p>
        <button
          type="button"
          onClick={onVolver}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Volver a la lista
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tarea.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="w-full"
      >
        <TareaItem
          tarea={tarea}
          isExpanded={true}
          onToggle={onVolver}
          isJefe={puedeGestionar}
          isRRHH={!puedeGestionar}
          usuarioActual={usuarioActualId}
          nombreUsuarioActual={nombreUsuarioActual}
          usuarios={usuariosAsignables}
        />
      </motion.div>
    </AnimatePresence>
  );
}

const AÑOS_DISPONIBLES = [2024, 2025, 2026, 2027, 2028];

interface GestorComisionProps {
  tipoVista?: "mis_comisiones" | "supervision";
}

export default function GestorComision({
  tipoVista = "mis_comisiones",
}: GestorComisionProps) {
  const user = useUser();
  const esSupervision = tipoVista === "supervision";
  const añoActual = new Date().getFullYear();
  const [año, setAño] = useState<number>(añoActual);
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "cargados" | "pendientes">("todos");
  const [comisionesAbiertas, setComisionesAbiertas] = useState<
    Record<string, boolean>
  >({});
  const [actividadEnfocada, setActividadEnfocada] = useState<{
    comisionId: string;
    tareaId: string;
  } | null>(null);
  const scrollPositionRef = useRef<number>(0);

  const abrirActividad = (comisionId: string, tareaId: string) => {
    if (typeof window !== "undefined") {
      scrollPositionRef.current = window.scrollY;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    setActividadEnfocada({ comisionId, tareaId });
  };

  const cerrarActividad = () => {
    setActividadEnfocada(null);
  };

  useEffect(() => {
    if (actividadEnfocada) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    } else if (scrollPositionRef.current > 0) {
      if (typeof window !== "undefined") {
        window.scrollTo({
          top: scrollPositionRef.current,
          left: 0,
          behavior: "instant",
        });
      }
    }
  }, [actividadEnfocada]);

  const misQuery = useMisComisiones(año, !esSupervision);
  const todasQuery = useTodasComisiones(año, esSupervision);

  const comisiones = esSupervision
    ? (todasQuery.data ?? [])
    : (misQuery.data ?? []);
  const isLoading = esSupervision ? todasQuery.isLoading : misQuery.isLoading;

  const comisionSeleccionada = useMemo(() => {
    if (!actividadEnfocada) return null;
    return comisiones.find((c) => c.id === actividadEnfocada.comisionId) || null;
  }, [actividadEnfocada, comisiones]);

  // Si cambia el año, restablecer filtro de estado y vista enfocada
  useEffect(() => {
    setFiltroEstado("todos");
    setActividadEnfocada(null);
  }, [año]);

  // Si está en "Mis Comisiones" y solo tiene 1 comisión, abrirla por defecto
  useEffect(() => {
    if (!esSupervision && comisiones.length === 1) {
      setComisionesAbiertas({ [comisiones[0].id]: true });
    }
  }, [esSupervision, comisiones]);

  const comisionesFiltradas = useMemo(() => {
    let list = comisiones;
    if (filtroEstado === "cargados") {
      list = list.filter((c) => Boolean(c.plan_trabajo));
    } else if (filtroEstado === "pendientes") {
      list = list.filter((c) => !c.plan_trabajo);
    }

    const q = busqueda.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(q)),
    );
  }, [comisiones, busqueda, filtroEstado]);

  const conPlanCount = comisiones.filter((c) => Boolean(c.plan_trabajo)).length;
  const sinPlanCount = comisiones.length - conPlanCount;

  const todasAbiertas =
    comisionesFiltradas.length > 0 &&
    comisionesFiltradas.every((c) => Boolean(comisionesAbiertas[c.id]));

  const toggleComision = (id: string) => {
    setComisionesAbiertas((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleTodasComisiones = () => {
    if (todasAbiertas) {
      setComisionesAbiertas({});
    } else {
      const next: Record<string, boolean> = {};
      for (const c of comisionesFiltradas) {
        next[c.id] = true;
      }
      setComisionesAbiertas(next);
    }
  };

  if (actividadEnfocada && comisionSeleccionada) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between pb-1">
          <motion.button
            type="button"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={cerrarActividad}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 cursor-pointer font-bold text-xs sm:text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Volver a la lista
          </motion.button>
          <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500 hidden sm:inline-block truncate max-w-md">
            {comisionSeleccionada.nombre}
          </span>
        </div>

        <DetalleActividadComision
          comision={comisionSeleccionada}
          año={año}
          tareaId={actividadEnfocada.tareaId}
          onVolver={cerrarActividad}
          esSupervision={esSupervision}
          currentUserId={user?.id}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col gap-2.5 sm:gap-4 rounded-xl sm:rounded-2xl border bg-card p-3 sm:p-6 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="flex size-9 sm:size-12 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-celeste-trifinio/15 text-celeste-trifinio">
            {esSupervision ? (
              <Building2 className="size-5 sm:size-6" />
            ) : (
              <Users className="size-5 sm:size-6" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-celeste-trifinio">
              COMUDE
            </p>
            <h1 className="text-sm sm:text-2xl font-extrabold text-foreground leading-tight truncate sm:whitespace-normal">
              {esSupervision ? "Todas las Comisiones" : "Mis Comisiones de Trabajo"}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm hidden sm:block">
              {esSupervision
                ? "Supervisa las comisiones de trabajo y planes anuales divididos por carpeta"
                : "Espacio colaborativo y gestión del plan de trabajo anual"}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {esSupervision ? (
            /* Vista de "Todas las Comisiones": En móvil, el año va en la misma fila a la par de los filtros */
            <>
              {comisiones.length > 1 && (
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:size-4" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar comisión..."
                    className="h-8 sm:h-9 w-full rounded-lg sm:rounded-xl border bg-background pl-8 pr-2.5 sm:pl-9 sm:pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-celeste-trifinio/40"
                  />
                </div>
              )}

              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 w-full sm:w-auto">
                {comisiones.length > 0 && (
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setFiltroEstado((prev) =>
                          prev === "cargados" ? "todos" : "cargados",
                        )
                      }
                      className={`flex h-[26px] sm:h-8 items-center gap-1 sm:gap-1.5 rounded-md sm:rounded-lg border px-2 sm:px-2.5 text-[10px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                        filtroEstado === "cargados"
                          ? "border-emerald-500 bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                      title={
                        filtroEstado === "cargados"
                          ? "Quitar filtro (mostrar todas)"
                          : "Filtrar comisiones con plan cargado"
                      }
                    >
                      <CheckCircle2 className="size-3 sm:size-3.5 shrink-0" />
                      <span>{conPlanCount} Cargados</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFiltroEstado((prev) =>
                          prev === "pendientes" ? "todos" : "pendientes",
                        )
                      }
                      className={`flex h-[26px] sm:h-8 items-center gap-1 sm:gap-1.5 rounded-md sm:rounded-lg border px-2 sm:px-2.5 text-[10px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                        filtroEstado === "pendientes"
                          ? "border-amber-500 bg-amber-500/25 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                      }`}
                      title={
                        filtroEstado === "pendientes"
                          ? "Quitar filtro (mostrar todas)"
                          : "Filtrar comisiones pendientes"
                      }
                    >
                      <Clock className="size-3 sm:size-3.5 shrink-0" />
                      <span>{sinPlanCount} Pendientes</span>
                    </button>
                  </div>
                )}

                <div className="flex h-[26px] sm:h-8 items-center gap-1 sm:gap-1.5 rounded-md sm:rounded-lg border bg-background px-2 sm:px-2.5 text-[10px] sm:text-xs font-semibold shadow-2xs shrink-0 ml-auto sm:ml-0">
                  <Calendar className="size-3 sm:size-3.5 text-celeste-trifinio shrink-0" />
                  <span className="text-muted-foreground hidden sm:inline">Año:</span>
                  <select
                    value={año}
                    onChange={(e) => setAño(Number(e.target.value))}
                    className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-[10px] sm:text-xs py-0"
                  >
                    {AÑOS_DISPONIBLES.map((a) => (
                      <option
                        key={a}
                        value={a}
                        className="bg-popover text-popover-foreground"
                      >
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            /* Vista de "Mis Comisiones de Trabajo": Buscador y Año en la misma línea en móvil */
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {comisiones.length > 1 && (
                <div className="relative flex-1 sm:w-60 sm:flex-initial">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:size-4" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar comisión..."
                    className="h-8 sm:h-9 w-full rounded-lg sm:rounded-xl border bg-background pl-8 pr-2.5 sm:pl-9 sm:pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-celeste-trifinio/40"
                  />
                </div>
              )}

              <div className="flex h-8 sm:h-8 items-center gap-1 sm:gap-1.5 rounded-lg border bg-background px-2 sm:px-2.5 text-xs font-semibold shadow-2xs shrink-0 ml-auto sm:ml-0">
                <Calendar className="size-3.5 text-celeste-trifinio shrink-0" />
                <span className="text-muted-foreground hidden sm:inline">Año:</span>
                <select
                  value={año}
                  onChange={(e) => setAño(Number(e.target.value))}
                  className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-xs py-0"
                >
                  {AÑOS_DISPONIBLES.map((a) => (
                    <option
                      key={a}
                      value={a}
                      className="bg-popover text-popover-foreground"
                    >
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTENIDO ENCARPETADO */}
      {isLoading ? (
        <ComisionesListSkeleton />
      ) : comisiones.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 sm:p-14 text-center space-y-3 shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="size-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            {esSupervision
              ? "No hay comisiones activas registradas"
              : `Sin comisiones asignadas en ${año}`}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {esSupervision
              ? "Aún no se han registrado comisiones activas para este municipio en el módulo de Estructuras."
              : `Actualmente no figuras como integrante de ninguna comisión activa en el período ${año}. Si perteneces a una comisión en otro año, puedes cambiar el filtro superior.`}
          </p>
        </div>
      ) : comisionesFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground space-y-2">
          <p>
            No se encontraron comisiones
            {busqueda ? ` que coincidan con "${busqueda}"` : ""}
            {filtroEstado !== "todos"
              ? ` con estado "${filtroEstado === "cargados" ? "cargados" : "pendientes"}"`
              : ""}
            .
          </p>
          {(busqueda || filtroEstado !== "todos") && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltroEstado("todos");
              }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* BARRA SUPERIOR: CONTEO Y EXPANDIR/COLAPSAR TODAS */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500 dark:text-gray-400">
              Total en {año}: {comisionesFiltradas.length}{" "}
              {comisionesFiltradas.length === 1 ? "comisión" : "comisiones"}
            </span>
            {comisionesFiltradas.length > 1 && (
              <button
                type="button"
                onClick={toggleTodasComisiones}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {todasAbiertas ? "Colapsar todas" : "Expandir todas"}
              </button>
            )}
          </div>

          {/* LISTA DE CARPETAS DE COMISIONES */}
          <div className="space-y-3">
            {comisionesFiltradas.map((comision) => {
              const estaAbierta = Boolean(comisionesAbiertas[comision.id]);
              const tienePlan = Boolean(comision.plan_trabajo);

              return (
                <div
                  key={comision.id}
                  className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm transition-colors"
                >
                  {/* FILA DE CABECERA DEL ACORDEÓN (LIMPIA Y MINIMALISTA) */}
                  <div
                    onClick={() => toggleComision(comision.id)}
                    className="px-3 py-2.5 sm:px-4 sm:py-4 flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 sm:p-2.5 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                        <Building2 className="size-4 sm:size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 dark:text-white text-xs sm:text-base leading-snug">
                          {comision.nombre}
                        </h3>
                        {comision.descripcion && (
                          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {comision.descripcion}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      {/* BADGE DE ESTADO DEL PLAN (OCULTO EN MÓVIL PARA MAXIMIZAR EL ANCHO) */}
                      <span
                        className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tienePlan
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                      >
                        {tienePlan ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <Clock className="size-3.5" />
                        )}
                        <span>
                          {tienePlan ? "Plan cargado" : "Pendiente"}
                        </span>
                      </span>

                      <ChevronDown
                        size={18}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${estaAbierta ? "rotate-180" : ""
                          }`}
                      />
                    </div>
                  </div>

                  {/* INTERIOR DE LA CARPETA */}
                  <AnimatePresence initial={false}>
                    {estaAbierta && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 overflow-hidden"
                      >
                        <div className="px-1 py-2 sm:p-5">
                          <ComisionList
                            comision={comision}
                            año={año}
                            currentUserId={user?.id}
                            compactHeader={true}
                            esSupervision={esSupervision}
                            onSeleccionarActividad={(tareaId) =>
                              abrirActividad(comision.id, tareaId)
                            }
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
