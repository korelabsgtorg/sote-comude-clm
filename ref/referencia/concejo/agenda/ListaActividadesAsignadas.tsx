'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { obtenerTodasActividadesConcejo } from './tareas/lib/actividades';
import { ActividadConcejoConContexto } from './lib/esquemas';
import type { ArchivoAdjunto } from '@/components/tareas/types';
import ArchivosActividadModal from './modals/ArchivosActividadModal';
import EditarActividadModal from './modals/EditarActividadModal';
import { Button } from '@/components/ui/button';
import { User, Calendar, CheckCircle2, Clock, ChevronDown, Paperclip, ArrowRight, Pencil, AlertTriangle, Hourglass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CargandoAnimacion from '@/components/ui/animations/Cargando';
import useUserData from '@/hooks/sesion/useUserData';

const ACTIVIDADES_QUERY_KEY = ['actividades-concejo-todas', 'v3'] as const;

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

const lineasFechaActividad = (actividad: ActividadConcejoConContexto) => {
  const lineas: { label: string; fecha: string }[] = [];

  if (actividad.confirmed_at) {
    lineas.push({
      label: 'Confirmada',
      fecha: formatearFechaHorario(actividad.confirmed_at),
    });
  }
  if (actividad.due_date) {
    lineas.push({ label: 'Fecha límite', fecha: formatearFechaHorario(actividad.due_date) });
  }
  if (actividad.status === 'Completado' && actividad.updated_at) {
    lineas.push({
      label: 'Completada',
      fecha: formatearFechaHorario(actividad.updated_at),
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

type GrupoActividades = {
  agendaId: string;
  agendaTitulo: string;
  agendaFecha: string;
  agendaEstado: string;
  agendaDescripcion: string;
  items: ActividadConcejoConContexto[];
};

const estadoBadge = (actividad: ActividadConcejoConContexto) => {
  if (actividad.status === 'Completado') {
    return { label: 'Completado', clase: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
  }
  if (!actividad.confirmed_at) {
    return { label: 'Sin confirmar', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  }
  const vencida = new Date(actividad.due_date) < new Date();
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

const contarEstadosGrupo = (items: ActividadConcejoConContexto[]): ResumenEstadosGrupo => {
  const resumen = { pendientes: 0, asignadas: 0, vencidas: 0, completadas: 0, pendientesRevision: 0, revisadas: 0 };
  const ahora = new Date();

  items.forEach((actividad) => {
    if (actividad.revisado_por) {
      resumen.revisadas += 1;
    } else {
      resumen.pendientesRevision += 1;
    }

    if (actividad.status === 'Completado') {
      resumen.completadas += 1;
      return;
    }
    if (!actividad.confirmed_at) {
      resumen.pendientes += 1;
      return;
    }
    if (actividad.due_date && new Date(actividad.due_date) < ahora) {
      resumen.vencidas += 1;
      return;
    }
    resumen.asignadas += 1;
  });

  return resumen;
};

const ACCORDION_TRANSITION = { duration: 0.48, ease: [0.32, 0.72, 0, 1] as const };
const CONTENIDO_TRANSITION = { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const };

type ListaActividadesAsignadasProps = {
  filtroAnio: string;
  filtroMes: string | null;
};

export default function ListaActividadesAsignadas({
  filtroAnio,
  filtroMes,
}: ListaActividadesAsignadasProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { rol } = useUserData();
  const puedeEditar = ['SUPER', 'SECRETARIO', 'SEC-TECNICO'].includes(rol || '');
  const { data, isLoading } = useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: obtenerTodasActividadesConcejo,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const [actividadArchivos, setActividadArchivos] = useState<ActividadConcejoConContexto | null>(null);
  const [actividadEditando, setActividadEditando] = useState<ActividadConcejoConContexto | null>(null);
  const [mostrarSoloPendientes, setMostrarSoloPendientes] = useState(false);

  useEffect(() => {
    setGrupoAbierto(null);
  }, [filtroAnio, filtroMes]);

  const actividades = useMemo(() => {
    const todas = data ?? [];
    return todas.filter((actividad) => {
      if (!actividad.agenda_fecha) return false;
      const agendaDate = new Date(actividad.agenda_fecha);
      const agendaYear = agendaDate.getFullYear().toString();
      const agendaMonth = agendaDate.getMonth().toString();
      const cumpleAnio = filtroAnio === '' || agendaYear === filtroAnio;
      const cumpleMes = filtroMes === null || agendaMonth === filtroMes;
      const cumpleFiltroPendientes = mostrarSoloPendientes ? actividad.status !== 'Completado' : true;
      return cumpleAnio && cumpleMes && cumpleFiltroPendientes;
    });
  }, [data, filtroAnio, filtroMes, mostrarSoloPendientes]);

  const archivosPorActividad = useMemo(() => {
    const map = new Map<string, ArchivoAdjunto[]>();
    actividades.forEach((actividad) => {
      map.set(actividad.id, actividad.archivos ?? []);
    });
    return map;
  }, [actividades]);

  const grupos = useMemo(() => {
    const map = new Map<string, GrupoActividades>();
    actividades.forEach((a) => {
      const key = a.agenda_id || 'sin-sesion';
      if (!map.has(key)) {
        map.set(key, {
          agendaId: a.agenda_id,
          agendaTitulo: a.agenda_titulo,
          agendaFecha: a.agenda_fecha,
          agendaEstado: a.agenda_estado,
          agendaDescripcion: a.agenda_descripcion,
          items: [],
        });
      }
      map.get(key)!.items.push(a);
    });
    return Array.from(map.values());
  }, [actividades]);

  const getGrupoKey = (grupo: GrupoActividades) => grupo.agendaId || 'sin-sesion';

  const isGrupoAbierto = (key: string) => grupoAbierto === key;

  const toggleGrupo = (key: string) => {
    setGrupoAbierto((actual) => (actual === key ? null : key));
  };

  const cerrarArchivos = () => setActividadArchivos(null);

  if (isLoading) {
    return <CargandoAnimacion texto="Cargando actividades..." />;
  }

  const sinActividades = (data ?? []).length === 0;

  const archivosModal = actividadArchivos
    ? archivosPorActividad.get(actividadArchivos.id) ?? []
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <input 
          type="checkbox" 
          id="filtro-pendientes" 
          checked={mostrarSoloPendientes}
          onChange={(e) => setMostrarSoloPendientes(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-900 dark:checked:bg-purple-500 cursor-pointer"
        />
        <label htmlFor="filtro-pendientes" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          Ocultar actividades completadas
        </label>
      </div>

      {actividades.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-neutral-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            {sinActividades
              ? 'El Concejo aún no ha asignado actividades.'
              : 'No hay actividades asignadas o pendientes en el período seleccionado.'}
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
        {grupos
          .filter((grupo) => grupoAbierto === null || getGrupoKey(grupo) === grupoAbierto)
          .map((grupo) => {
          const grupoKey = getGrupoKey(grupo);
          const abierto = isGrupoAbierto(grupoKey);
          const resumen = contarEstadosGrupo(grupo.items);

          return (
            <motion.div
              layout
              key={grupoKey}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={ACCORDION_TRANSITION}
              className="overflow-hidden rounded-lg border border-gray-200 border-l-4 border-l-purple-500 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
            <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => toggleGrupo(grupoKey)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm md:text-base min-w-0">
                    <span>{grupo.agendaTitulo}</span>
                    {grupo.agendaDescripcion && (
                      <>
                        <span className="mx-1.5 font-normal text-gray-400 dark:text-gray-500">·</span>
                        <span className="font-normal text-gray-600 dark:text-gray-300">{grupo.agendaDescripcion}</span>
                      </>
                    )}
                    {grupo.agendaFecha && (
                      <>
                        <span className="mx-1.5 hidden font-normal text-gray-400 dark:text-gray-500 lg:inline">·</span>
                        <span className="hidden font-normal text-gray-500 dark:text-gray-400 lg:inline">
                          {formatearFechaHorario(grupo.agendaFecha)}
                        </span>
                      </>
                    )}
                  </p>
                  {grupo.agendaFecha && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 md:text-sm lg:hidden">
                      {formatearFechaHorario(grupo.agendaFecha)}
                    </p>
                  )}
                  <p className="mt-1 text-xs font-medium">
                    <span className={estadoAgendaClase(grupo.agendaEstado)}>{grupo.agendaEstado}</span>
                    <span className="text-gray-400 dark:text-gray-500"> · </span>
                    <span className="text-gray-600 dark:text-gray-300">
                      {grupo.items.length} {grupo.items.length === 1 ? 'actividad' : 'actividades'}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {resumen.asignadas > 0 && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {resumen.asignadas} {resumen.asignadas === 1 ? 'asignada' : 'asignadas'}
                      </span>
                    )}
                    {resumen.pendientes > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {resumen.pendientes} {resumen.pendientes === 1 ? 'pendiente' : 'pendientes'}
                      </span>
                    )}
                    {resumen.vencidas > 0 && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {resumen.vencidas} {resumen.vencidas === 1 ? 'vencida' : 'vencidas'}
                      </span>
                    )}
                    {resumen.completadas > 0 && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        {resumen.completadas} {resumen.completadas === 1 ? 'completada' : 'completadas'}
                      </span>
                    )}
                    {(resumen.pendientesRevision > 0 || resumen.revisadas > 0) && (
                      <span className="mx-0.5 font-bold text-gray-300 dark:text-gray-600">|</span>
                    )}
                    {resumen.pendientesRevision > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {resumen.pendientesRevision} pend. revisión
                      </span>
                    )}
                    {resumen.revisadas > 0 && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {resumen.revisadas} {resumen.revisadas === 1 ? 'revisada' : 'revisadas'}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGrupo(grupoKey)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-gray-200"
                    aria-expanded={abierto}
                    aria-label={abierto ? 'Contraer actividades' : 'Expandir actividades'}
                  >
                    <ChevronDown
                      size={20}
                      className={`transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${abierto ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {grupo.agendaId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/protected/concejo/agenda/${grupo.agendaId}`)}
                      className="h-8 shrink-0 cursor-pointer gap-1.5 px-2 text-green-600 hover:bg-green-100 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/30 border border-green-600 dark:border-green-400"
                    >
                      Ir a sesión
                      <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>

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
                  <ul className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-100/70 p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
                    {grupo.items.map((actividad, index) => {
                      const badge = estadoBadge(actividad);
                      const totalArchivos = archivosPorActividad.get(actividad.id)?.length ?? 0;
                      const fechasActividad = lineasFechaActividad(actividad);
                      const retrasoText = formatRetraso(actividad.due_date, actividad.updated_at);
                      const tiempoRestanteText = formatTiempoRestante(actividad.due_date);

                      return (
                        <li
                          key={actividad.id}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className="flex min-w-0 items-start gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-[11px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-white">
                                  {index + 1}
                                </span>
                                <span>
                                  <span className="text-muted-foreground">Punto </span>
                                  <span className="text-zinc-900 dark:text-white">{actividad.punto_titulo}</span>
                                </span>
                              </p>
                              <span className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${badge.clase}`}>
                                {actividad.confirmed_at || actividad.status === 'Completado' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                                {badge.label}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <p className="flex items-center gap-1.5 text-sm font-medium text-[#0066cc] dark:text-blue-400">
                                  <User size={14} className="shrink-0" />
                                  {actividad.assignee_nombre}
                                </p>
                                {actividad.revisado_por ? (
                                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/20">
                                    Revisado por: {actividad.revisado_por.nombre}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/20">
                                    Pendiente de revisión
                                  </span>
                                )}
                              </div>
                              {actividad.description?.trim() ? (
                                <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-relaxed text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-300">
                                  {actividad.description}
                                </p>
                              ) : null}
                              {actividad.miembros && actividad.miembros.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-zinc-600 dark:text-zinc-300">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Participantes:</span>
                                  {actividad.miembros.map((m) => (
                                    <span key={m.id} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-xs">
                                      <User size={11} className="text-purple-500" />
                                      <span>{m.nombre_usuario}</span>
                                      {m.confirmed_at ? (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">({formatearFechaHorario(m.confirmed_at)})</span>
                                      ) : (
                                        <span className="text-[10px] text-orange-500 font-medium">(Sin confirmar)</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                {fechasActividad.length > 0 && (
                                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <Calendar size={12} className="mt-0.5 shrink-0" />
                                    <p className="min-w-0">
                                      {fechasActividad.map((linea, i) => (
                                        <React.Fragment key={linea.label}>
                                          {i > 0 && (
                                            <span className="mx-1.5 font-normal text-gray-400 dark:text-gray-500">·</span>
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
                                  <span className="text-xs font-semibold text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={14} />
                                    {actividad.status === 'Completado' ? `Se completó con un tiempo tardío de: ${retrasoText.replace(/^Atrasada por /i, '')}` : retrasoText}
                                  </span>
                                )}
                                {!retrasoText && tiempoRestanteText && actividad.status !== 'Completado' && (
                                  <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 mt-1 flex items-center gap-1">
                                    <Hourglass size={14} />
                                    {tiempoRestanteText}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center justify-end gap-2">
                                {puedeEditar && (
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
      )}

      <ArchivosActividadModal
        open={!!actividadArchivos}
        onClose={cerrarArchivos}
        tituloActividad={actividadArchivos?.title ?? ''}
        archivos={archivosModal}
      />
      <EditarActividadModal
        open={!!actividadEditando}
        actividad={actividadEditando}
        onClose={() => setActividadEditando(null)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ACTIVIDADES_QUERY_KEY });
        }}
      />
    </div>
  );
}
