'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Calendar,
  CheckCircle2,
  Clock,
  Paperclip,
  ArrowRight,
  Pencil,
  AlertTriangle,
  Hourglass,
  Loader2,
  CheckSquare,
  Eye,
} from 'lucide-react';
import { useTodasActividadesComude } from './lib/hooks';
import { ActividadComudeConContexto, ActComudePunto } from './lib/zod';
import ActividadesPuntoModal from './modals/ActividadesPuntoModal';
import ArchivosActividadModal from './modals/ArchivosActividadModal';
import EditarActividadComudeModal from './modals/EditarActividadComudeModal';

const ACCORDION_TRANSITION = { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const };
const CONTENIDO_TRANSITION = { duration: 0.3, ease: [0.32, 0.72, 0, 1] as const };

const formatearFechaHorario = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const diaSemana = dias[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  let hora = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const period = hora >= 12 ? 'PM' : 'AM';
  hora = hora % 12;
  hora = hora ? hora : 12;
  const horaStr = String(hora).padStart(2, '0');
  return `${diaSemana} ${day}/${month}/${year}, ${horaStr}:${minutos} ${period}`;
};

const formatRetraso = (dueDateStr: string, completedAtStr?: string | null) => {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const end = completedAtStr ? new Date(completedAtStr) : new Date();
  const diffMs = end.getTime() - due.getTime();
  if (diffMs <= 0) return null;

  const diffMins = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMins / 1440);
  const hours = Math.floor((diffMins % 1440) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} día${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);

  if (parts.length === 0) return 'Menos de 1 hr';
  return `Atrasada por ${parts.join(', ')}`;
};

const formatTiempoRestante = (dueDateStr: string) => {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const diffMins = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMins / 1440);
  const hours = Math.floor((diffMins % 1440) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} día${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);

  if (parts.length === 0) return 'Menos de 1 hr';
  return `Faltan ${parts.join(', ')}`;
};

const lineasFechaActividad = (actividad: ActividadComudeConContexto) => {
  const lineas: { label: string; fecha: string }[] = [];

  if (actividad.fecha_confirmacion) {
    lineas.push({
      label: 'Confirmada',
      fecha: formatearFechaHorario(actividad.fecha_confirmacion),
    });
  }
  if (actividad.fecha_limite) {
    lineas.push({
      label: 'Fecha límite',
      fecha: formatearFechaHorario(actividad.fecha_limite),
    });
  }
  if (actividad.estado === 'Completado' && actividad.actualizado_en) {
    lineas.push({
      label: 'Completada',
      fecha: formatearFechaHorario(actividad.actualizado_en),
    });
  }

  return lineas;
};

const estadoAgendaClase = (estado: string) => {
  if (estado === 'En progreso') {
    return 'text-green-600 dark:text-green-400';
  }
  if (estado === 'Finalizada') {
    return 'text-gray-500 dark:text-gray-400';
  }
  return 'text-blue-600 dark:text-blue-400';
};

const estadoBadge = (actividad: ActividadComudeConContexto) => {
  if (actividad.estado === 'Completado') {
    return { label: 'Completado', clase: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
  }
  if (!actividad.fecha_confirmacion) {
    return { label: 'Sin confirmar', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  }
  const vencida = actividad.fecha_limite && new Date(actividad.fecha_limite) < new Date();
  if (vencida) {
    return { label: 'Vencida', clase: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
  }
  return { label: 'Asignada', clase: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
};

type ResumenEstadosGrupo = {
  pendientes: number;
  asignadas: number;
  vencidas: number;
  completadas: number;
  pendientesRevision: number;
  revisadas: number;
};

const contarEstadosGrupo = (items: ActividadComudeConContexto[]): ResumenEstadosGrupo => {
  const resumen = { pendientes: 0, asignadas: 0, vencidas: 0, completadas: 0, pendientesRevision: 0, revisadas: 0 };
  const ahora = new Date();

  items.forEach((actividad) => {
    if (actividad.revisado_por) {
      resumen.revisadas += 1;
    } else {
      resumen.pendientesRevision += 1;
    }

    if (actividad.estado === 'Completado') {
      resumen.completadas += 1;
      return;
    }
    if (!actividad.fecha_confirmacion) {
      resumen.pendientes += 1;
      return;
    }
    if (actividad.fecha_limite && new Date(actividad.fecha_limite) < ahora) {
      resumen.vencidas += 1;
      return;
    }
    resumen.asignadas += 1;
  });

  return resumen;
};

interface GrupoActividades {
  comudeId: string;
  comudeTitulo: string;
  comudeFecha: string;
  comudeEstado: string;
  comudeDescripcion?: string | null;
  items: ActividadComudeConContexto[];
}

interface ListaActividadesAsignadasComudeProps {
  filtroAnio: number;
  filtroMes: number;
  searchQuery?: string;
  puedeGestionar: boolean;
  effectiveRole: string;
  userId?: string | null;
  onIrASesion?: (comudeId: string, comudeFecha: string) => void;
}

export default function ListaActividadesAsignadasComude({
  filtroAnio,
  filtroMes,
  searchQuery = '',
  puedeGestionar,
  effectiveRole,
  userId,
  onIrASesion,
}: ListaActividadesAsignadasComudeProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useTodasActividadesComude();
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const [mostrarSoloPendientes, setMostrarSoloPendientes] = useState(false);

  const [actividadArchivos, setActividadArchivos] = useState<ActividadComudeConContexto | null>(null);
  const [actividadEditando, setActividadEditando] = useState<ActividadComudeConContexto | null>(null);

  // Modal de actividad para edición
  const [modalActividadPunto, setModalActividadPunto] = useState<{
    isOpen: boolean;
    punto: ActComudePunto | null;
    actComudeId: string;
  }>({
    isOpen: false,
    punto: null,
    actComudeId: '',
  });

  const actividadesFiltradas = useMemo(() => {
    const todas = data ?? [];
    return todas.filter((actividad) => {
      // Filtro de búsqueda por título o punto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const coincide =
          actividad.titulo.toLowerCase().includes(query) ||
          actividad.punto_titulo.toLowerCase().includes(query) ||
          actividad.comude_titulo.toLowerCase().includes(query) ||
          actividad.encargado_nombre.toLowerCase().includes(query);
        if (!coincide) return false;
      }

      // Filtro por fecha de la sesión
      if (actividad.comude_fecha) {
        const comudeDate = new Date(actividad.comude_fecha);
        const anioMatch = filtroAnio ? comudeDate.getFullYear() === filtroAnio : true;
        const mesMatch = filtroMes === -1 || comudeDate.getMonth() === filtroMes;
        if (!anioMatch || !mesMatch) return false;
      }

      // Filtro de pendientes
      if (mostrarSoloPendientes && actividad.estado === 'Completado') {
        return false;
      }

      return true;
    });
  }, [data, searchQuery, filtroAnio, filtroMes, mostrarSoloPendientes]);

  const grupos = useMemo(() => {
    const map = new Map<string, GrupoActividades>();
    actividadesFiltradas.forEach((a) => {
      const key = a.comude_id || 'sin-sesion';
      if (!map.has(key)) {
        map.set(key, {
          comudeId: a.comude_id,
          comudeTitulo: a.comude_titulo,
          comudeFecha: a.comude_fecha,
          comudeEstado: a.comude_estado,
          comudeDescripcion: a.comude_descripcion,
          items: [],
        });
      }
      map.get(key)!.items.push(a);
    });
    return Array.from(map.values());
  }, [actividadesFiltradas]);

  const toggleGrupo = (key: string) => {
    setGrupoAbierto((actual) => (actual === key ? null : key));
  };

  const abrirModalPunto = (actividad: ActividadComudeConContexto) => {
    setModalActividadPunto({
      isOpen: true,
      punto: {
        id: actividad.punto_id,
        act_comude_id: actividad.comude_id,
        categoria_id: null,
        titulo: actividad.punto_titulo,
        estado: 'Pendiente',
        votacion: null,
        notas: null,
        orden: 1,
        created_at: actividad.created_at,
      },
      actComudeId: actividad.comude_id,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
        <p className="text-sm font-medium text-muted-foreground">Cargando actividades asignadas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-sm text-destructive">
        Error al cargar las actividades asignadas.
        <button onClick={() => refetch()} className="ml-2 underline font-semibold">
          Reintentar
        </button>
      </div>
    );
  }

  const sinActividadesTotales = (data ?? []).length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Controles de filtro */}
      <div className="flex items-center justify-between gap-2 px-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            id="filtro-pendientes-comude"
            checked={mostrarSoloPendientes}
            onChange={(e) => setMostrarSoloPendientes(e.target.checked)}
            className="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ocultar actividades completadas
          </span>
        </label>

        <span className="text-xs text-muted-foreground">
          {actividadesFiltradas.length} actividad{actividadesFiltradas.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {actividadesFiltradas.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-2xl bg-card/40">
          <p className="text-sm text-muted-foreground">
            {sinActividadesTotales
              ? 'Aún no hay actividades asignadas registradas en COMUDE.'
              : 'No hay actividades asignadas o pendientes en el período seleccionado.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <AnimatePresence initial={false} mode="popLayout">
            {grupos.map((grupo) => {
              const grupoKey = grupo.comudeId || 'sin-sesion';
              const abierto = grupoAbierto === grupoKey;
              const resumen = contarEstadosGrupo(grupo.items);

              return (
                <motion.div
                  layout
                  key={grupoKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={ACCORDION_TRANSITION}
                  className="overflow-hidden rounded-lg border border-border/80 dark:border-border/50 border-l-4 border-l-purple-500 bg-white dark:bg-black/40 shadow-xs"
                >
                {/* Cabecera del grupo / sesión */}
                <div className="px-4 py-1.5 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                  <div className="flex flex-col gap-1">
                    {/* Fila superior: Título completo que ocupa el 100% del ancho en móvil y PC */}
                    <button
                      type="button"
                      onClick={() => toggleGrupo(grupoKey)}
                      className="w-full cursor-pointer text-left focus:outline-none"
                    >
                      <p className="font-semibold text-foreground text-sm md:text-base leading-snug">
                        <span>{grupo.comudeTitulo}</span>
                        {grupo.comudeDescripcion && (
                          <>
                            <span className="mx-1.5 font-normal text-muted-foreground">·</span>
                            <span className="font-normal text-muted-foreground">{grupo.comudeDescripcion}</span>
                          </>
                        )}
                        {grupo.comudeFecha && (
                          <>
                            <span className="mx-1.5 hidden font-normal text-muted-foreground lg:inline">·</span>
                            <span className="hidden font-normal text-muted-foreground lg:inline">
                              {formatearFechaHorario(grupo.comudeFecha)}
                            </span>
                          </>
                        )}
                      </p>
                    </button>

                    {/* Fila intermedia: Fecha y Estado (izquierda) e "Ir a sesión" (derecha) */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleGrupo(grupoKey)}
                        className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2.5"
                      >
                        {grupo.comudeFecha && (
                          <p className="text-xs text-muted-foreground md:text-sm lg:hidden">
                            {formatearFechaHorario(grupo.comudeFecha)}
                          </p>
                        )}
                        <p className="text-xs font-medium shrink-0">
                          <span className={estadoAgendaClase(grupo.comudeEstado)}>{grupo.comudeEstado}</span>
                          <span className="text-muted-foreground"> · </span>
                          <span className="text-muted-foreground">
                            {grupo.items.length} {grupo.items.length === 1 ? 'actividad' : 'actividades'}
                          </span>
                        </p>

                        {/* En PC (sm:), los badges continúan en esta misma fila */}
                        <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                          {resumen.asignadas > 0 && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                              {resumen.asignadas} {resumen.asignadas === 1 ? 'asignada' : 'asignadas'}
                            </span>
                          )}
                          {resumen.pendientes > 0 && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              {resumen.pendientes} {resumen.pendientes === 1 ? 'pendiente' : 'pendientes'}
                            </span>
                          )}
                          {resumen.vencidas > 0 && (
                            <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                              {resumen.vencidas} {resumen.vencidas === 1 ? 'vencida' : 'vencidas'}
                            </span>
                          )}
                          {resumen.completadas > 0 && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-400">
                              {resumen.completadas} {resumen.completadas === 1 ? 'completada' : 'completadas'}
                            </span>
                          )}
                          {(resumen.pendientesRevision > 0 || resumen.revisadas > 0) && (
                            <span className="mx-0.5 font-bold text-muted-foreground/40">|</span>
                          )}
                          {resumen.pendientesRevision > 0 && (
                            <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                              {resumen.pendientesRevision} pend. revisión
                            </span>
                          )}
                          {resumen.revisadas > 0 && (
                            <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                              {resumen.revisadas} {resumen.revisadas === 1 ? 'revisada' : 'revisadas'}
                            </span>
                          )}
                        </div>
                      </button>

                      {grupo.comudeId && onIrASesion && (
                        <div className="flex shrink-0 items-center pl-2">
                          <button
                            type="button"
                            onClick={() => onIrASesion(grupo.comudeId, grupo.comudeFecha)}
                            className="h-7 shrink-0 cursor-pointer flex items-center gap-1 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/30 transition-colors"
                          >
                            Ir a sesión
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* En móvil (< sm), los badges se muestran en su propia fila de 100% ancho para que todos quepan en una sola línea */}
                    <button
                      type="button"
                      onClick={() => toggleGrupo(grupoKey)}
                      className="w-full cursor-pointer text-left focus:outline-none sm:hidden pt-0.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {resumen.asignadas > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                            {resumen.asignadas} {resumen.asignadas === 1 ? 'asignada' : 'asignadas'}
                          </span>
                        )}
                        {resumen.pendientes > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            {resumen.pendientes} {resumen.pendientes === 1 ? 'pendiente' : 'pendientes'}
                          </span>
                        )}
                        {resumen.vencidas > 0 && (
                          <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                            {resumen.vencidas} {resumen.vencidas === 1 ? 'vencida' : 'vencidas'}
                          </span>
                        )}
                        {resumen.completadas > 0 && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-400">
                            {resumen.completadas} {resumen.completadas === 1 ? 'completada' : 'completadas'}
                          </span>
                        )}
                        {(resumen.pendientesRevision > 0 || resumen.revisadas > 0) && (
                          <span className="mx-0.5 font-bold text-muted-foreground/40">|</span>
                        )}
                        {resumen.pendientesRevision > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                            {resumen.pendientesRevision} pend. revisión
                          </span>
                        )}
                        {resumen.revisadas > 0 && (
                          <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                            {resumen.revisadas} {resumen.revisadas === 1 ? 'revisada' : 'revisadas'}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Contenido expandible del acordeón */}
                <AnimatePresence initial={false} mode="sync">
                  {abierto && (
                    <motion.div
                      key={`contenido-${grupoKey}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={CONTENIDO_TRANSITION}
                      className="overflow-hidden"
                    >
                      <ul className="flex flex-col gap-2.5 border-t border-border/60 dark:border-border/50 bg-muted/30 dark:bg-black/20 p-2.5 sm:p-3">
                        {grupo.items.map((actividad, index) => {
                          const badge = estadoBadge(actividad);
                          const totalArchivos = actividad.archivos?.length ?? 0;
                          const fechasActividad = lineasFechaActividad(actividad);
                          const retrasoText = formatRetraso(actividad.fecha_limite, actividad.actualizado_en);
                          const tiempoRestanteText = formatTiempoRestante(actividad.fecha_limite);
                          const checklistItems = actividad.checklist || [];
                          const checklistCompletados = checklistItems.filter((c) => c.is_completed).length;

                          return (
                            <li
                              key={actividad.id}
                              className="rounded-xl border border-border/80 dark:border-border/50 bg-white dark:bg-black/40 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs transition-all hover:border-purple-500/30"
                            >
                              <div className="min-w-0">
                                {/* Encabezado de la actividad */}
                                <div className="flex flex-col gap-1.5">
                                  {/* Fila 1: Punto y Estado alineados */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-foreground">
                                        {index + 1}
                                      </span>
                                      <p className="min-w-0 text-xs text-muted-foreground font-normal">
                                        Punto: <span className="font-semibold text-foreground">{actividad.punto_titulo}</span>
                                      </p>
                                    </div>
                                    <span className={`flex h-7 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ${badge.clase}`}>
                                      {actividad.fecha_confirmacion || actividad.estado === 'Completado' ? (
                                        <CheckCircle2 size={13} />
                                      ) : (
                                        <Clock size={13} />
                                      )}
                                      {badge.label}
                                    </span>
                                  </div>

                                  {/* Fila 2: Título de la actividad a todo el ancho */}
                                  <p className="text-sm font-bold text-foreground leading-snug break-words">
                                    {actividad.titulo}
                                  </p>
                                </div>

                                {/* Encargado, revisión y descripción */}
                                <div className="mt-2.5 flex flex-col gap-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <p className="flex items-center gap-1.5 text-sm font-medium text-azul-trifinio dark:text-celeste-trifinio">
                                      <User size={14} className="shrink-0" />
                                      {actividad.encargado_nombre}
                                      {actividad.encargado_puesto && (
                                        <span className="text-xs text-muted-foreground font-normal">
                                          ({actividad.encargado_puesto})
                                        </span>
                                      )}
                                    </p>
                                    {actividad.revisado_por ? (
                                      <span className="inline-flex items-center rounded-md bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 border border-green-500/20">
                                        Revisado por: {actividad.revisado_por.nombre}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400 border border-red-500/20">
                                        Pendiente de revisión
                                      </span>
                                    )}
                                  </div>

                                  {actividad.descripcion?.trim() && (
                                    <p className="whitespace-pre-wrap rounded-xl bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                      {actividad.descripcion}
                                    </p>
                                  )}

                                  {/* Participantes / Miembros */}
                                  {actividad.miembros && actividad.miembros.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                        Participantes:
                                      </span>
                                      {actividad.miembros.map((m) => (
                                        <span
                                          key={m.id}
                                          className="inline-flex items-center gap-1 rounded-lg bg-muted/60 border border-border/50 px-2 py-0.5 text-xs text-foreground"
                                        >
                                          <User size={11} className="text-purple-500" />
                                          <span>{m.nombre_usuario}</span>
                                          {m.fecha_confirmacion ? (
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                              (Confirmado)
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-orange-500 font-medium">
                                              (Sin confirmar)
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Indicador de checklist si tiene tareas */}
                                  {checklistItems.length > 0 && (
                                    <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                                      <CheckSquare size={13} className="text-purple-500" />
                                      <span className="font-medium">
                                        Checklist: {checklistCompletados} de {checklistItems.length} completados
                                      </span>
                                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
                                        <div
                                          className="h-full bg-purple-500 rounded-full transition-all"
                                          style={{
                                            width: `${Math.round((checklistCompletados / checklistItems.length) * 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Fechas, alerta de atraso y botón de edición */}
                                <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    {fechasActividad.length > 0 && (
                                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                        <Calendar size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                                        <p className="min-w-0">
                                          {fechasActividad.map((linea, i) => (
                                            <React.Fragment key={linea.label}>
                                              {i > 0 && (
                                                <span className="mx-1.5 font-normal text-muted-foreground/60">·</span>
                                              )}
                                              <span>
                                                {linea.label}: {linea.fecha}
                                              </span>
                                            </React.Fragment>
                                          ))}
                                        </p>
                                      </div>
                                    )}

                                    {retrasoText && (
                                      <span className="text-xs font-semibold text-red-500 dark:text-red-400 mt-0.5 flex items-center gap-1">
                                        <AlertTriangle size={13} />
                                        {actividad.estado === 'Completado'
                                          ? `Se completó con retraso: ${retrasoText.replace(/^Atrasada por /i, '')}`
                                          : retrasoText}
                                      </span>
                                    )}
                                    {!retrasoText && tiempoRestanteText && actividad.estado !== 'Completado' && (
                                      <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                        <Hourglass size={13} />
                                        {tiempoRestanteText}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex shrink-0 items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => abrirModalPunto(actividad)}
                                      className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                      <Eye size={14} className="shrink-0 text-[#0066cc] dark:text-blue-400" />
                                      Ver
                                    </button>
                                    {puedeGestionar && (
                                      <button
                                        type="button"
                                        onClick={() => setActividadEditando(actividad)}
                                        className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                      >
                                        <Pencil size={14} className="shrink-0 text-[#0066cc] dark:text-blue-400" />
                                        Editar
                                      </button>
                                    )}
                                    {totalArchivos > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setActividadArchivos(actividad)}
                                        className="relative flex h-8 w-auto shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 pr-7 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-700"
                                      >
                                        <Paperclip size={14} className="shrink-0 text-[#0066cc] dark:text-blue-400" />
                                        <span className="text-xs font-semibold leading-none text-zinc-700 dark:text-zinc-200">
                                          Archivos cargados
                                        </span>
                                        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0066cc] px-1.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-blue-400 dark:text-zinc-900">
                                          {totalArchivos}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    )}

      {/* Modal interactivo de actividades del punto */}
      {modalActividadPunto.isOpen && modalActividadPunto.punto && (
        <ActividadesPuntoModal
          isOpen={modalActividadPunto.isOpen}
          onClose={() =>
            setModalActividadPunto({
              isOpen: false,
              punto: null,
              actComudeId: '',
            })
          }
          punto={modalActividadPunto.punto}
          actComudeId={modalActividadPunto.actComudeId}
          canManage={puedeGestionar}
        />
      )}

      {/* Modal de archivos adjuntos */}
      <ArchivosActividadModal
        open={!!actividadArchivos}
        onClose={() => setActividadArchivos(null)}
        tituloActividad={actividadArchivos?.titulo ?? ''}
        archivos={actividadArchivos?.archivos ?? []}
      />

      {/* Modal de edición de actividad con bitácora y menciones */}
      <EditarActividadComudeModal
        open={!!actividadEditando}
        actividad={actividadEditando}
        onClose={() => setActividadEditando(null)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['actividades-comude-todas'] });
        }}
      />
    </div>
  );
}
