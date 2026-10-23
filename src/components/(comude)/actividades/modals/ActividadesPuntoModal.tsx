'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  User,
  AlignLeft,
  CheckSquare,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { notifyActividadPendienteRefresh } from '@/components/push/PushListener';
import { cn } from '@/lib/utils';
import {
  ActComudePunto,
  ActividadPunto,
  ActividadPuntoMiembro,
  UsuarioAsignablePunto,
} from '../lib/zod';
import {
  useActividadesDePunto,
  useUsuariosAsignablesMunicipio,
  useCrearActividadPunto,
  useEditarActividadPunto,
  useEliminarActividadPunto,
  useToggleChecklistPunto,
  useToggleMiembroChecklistPunto,
  useMarcarRevisadoPorComude,
  useDesmarcarRevisadoPorComude,
  useFinalizarActividadPunto,
} from '../lib/hooks';
import { useUserContext } from '@/components/(base)/providers/UserProvider';

interface ActividadesPuntoModalProps {
  isOpen: boolean;
  onClose: () => void;
  punto: ActComudePunto | null;
  actComudeId: string;
  canManage: boolean;
}

type Vista = 'lista' | 'formulario';

// ─── Helpers de fecha y formato ──────────────────────────────
const fechaPorDefecto = () => {
  const d = new Date();
  d.setHours(16, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T16:00`;
};

const formatearFechaBitacora = (fecha: Date | string = new Date()) => {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return '';
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

const componerBitacoraActividad = ({
  nota,
  anterior,
  cambios = [],
}: {
  nota?: string;
  anterior: string | null | undefined;
  cambios?: string[];
}) => {
  const notaLimpia = nota?.trim() ?? '';
  const cambiosLimpios = cambios.map((c) => c.trim()).filter(Boolean);
  const previa = anterior?.trim() ?? '';

  if (!notaLimpia && cambiosLimpios.length === 0) return previa;

  const cuerpo = [notaLimpia, ...cambiosLimpios].filter(Boolean).join('\n');
  const entrada = `${formatearFechaBitacora()}\n${cuerpo}`;
  return previa ? `${entrada}\n\n${previa}` : entrada;
};

const formatearFechaInput = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatearFechaActividad = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  let hora = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const period = hora >= 12 ? 'PM' : 'AM';
  hora = hora % 12;
  hora = hora ? hora : 12;
  const horaStr = String(hora).padStart(2, '0');
  return `${day}/${month}/${year} a las ${horaStr}:${minutos} ${period}`;
};

const getNombreCorto = (nombreCompleto: string | undefined | null) => {
  if (!nombreCompleto) return 'Sin nombre';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 2) return nombreCompleto;
  return `${partes[0]} ${partes[1]}`;
};

const renderConfirmacion = (isoString?: string | null) => {
  if (!isoString) {
    return <span className="text-[10px] text-orange-500 font-medium ml-1.5 whitespace-nowrap">Pendiente</span>;
  }
  const d = new Date(isoString);
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
  return (
    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium ml-1.5 whitespace-nowrap">
      Confirmación: {diaSemana} {day}/{month}/{year}, {horaStr}:{minutos} {period}
    </span>
  );
};

const getColorBarra = (pct: number) => {
  if (pct === 100) return 'bg-emerald-500';
  if (pct > 75) return 'bg-yellow-300';
  if (pct > 50) return 'bg-yellow-500';
  if (pct > 25) return 'bg-orange-500';
  if (pct > 0) return 'bg-red-600';
  return 'bg-zinc-200 dark:bg-zinc-700';
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

// ─── Componente DetalleActividadPanel (Estilo Exacto Referencia) ───
function DetalleActividadPanel({
  actividad,
  indice,
  puntoId,
  puedeEditar,
  onEditar,
  onEliminar,
  onMarcarRevisado,
  onDesmarcarRevisado,
  onFinalizar,
  cargandoAccionId,
}: {
  actividad: ActividadPunto;
  indice: number;
  puntoId: string;
  puedeEditar: boolean;
  onEditar: (act: ActividadPunto) => void;
  onEliminar: (act: ActividadPunto) => void;
  onMarcarRevisado?: (act: ActividadPunto) => void;
  onDesmarcarRevisado?: (act: ActividadPunto) => void;
  onFinalizar?: (act: ActividadPunto) => void;
  cargandoAccionId?: string | null;
}) {
  const { user } = useUserContext();
  const [tabActivo, setTabActivo] = useState<string>('encargado');
  const { mutate: toggleChecklist } = useToggleChecklistPunto();
  const { mutate: toggleMiembroChecklist } = useToggleMiembroChecklistPunto();

  const esAsignadoAMi = actividad.encargado_id === user?.id;

  const miembros = actividad.miembros || [];
  const esGrupal = miembros.length > 0;

  const checklist = actividad.checklist || [];
  const totalEncargado = checklist.length;
  const completadosEncargado = checklist.filter((item) => item.is_completed).length;
  const porcentajeEncargado = totalEncargado === 0 ? (actividad.estado === 'Completado' ? 100 : 0) : Math.round((completadosEncargado / totalEncargado) * 100);

  const totalMiembros = miembros.reduce((s, m) => s + (m.asignaciones?.length || 0), 0);
  const completadosMiembros = miembros.reduce(
    (s, m) => s + (m.asignaciones?.filter((a) => a.is_complete).length || 0),
    0
  );
  const totalGlobal = totalEncargado + (esGrupal ? totalMiembros : 0);
  const completosGlobal = completadosEncargado + (esGrupal ? completadosMiembros : 0);
  const porcentajeGlobal = totalGlobal === 0 ? (actividad.estado === 'Completado' ? 100 : 0) : Math.round((completosGlobal / totalGlobal) * 100);

  const retrasoText = formatRetraso(actividad.fecha_limite, actividad.actualizado_en);

  const tabs = useMemo(() => {
    if (!esGrupal) return [];
    return [
      {
        id: 'encargado',
        label: getNombreCorto(actividad.encargado_nombre) || 'Encargado',
        confirmedAt: actividad.fecha_confirmacion,
        completedAt: actividad.estado === 'Completado',
        rol: 'Encargado',
      },
      ...miembros.map((m) => ({
        id: m.id,
        label: getNombreCorto(m.nombre_usuario) || 'Miembro',
        confirmedAt: m.fecha_confirmacion,
        completedAt: !!m.fecha_finalizacion,
        rol: 'Miembro',
      })),
    ];
  }, [esGrupal, actividad.encargado_nombre, actividad.estado, actividad.fecha_confirmacion, miembros]);

  const activeMember = miembros.find((m) => m.id === tabActivo);

  const handleToggleGlobalCheck = (index: number) => {
    const nuevo = [...checklist];
    nuevo[index] = { ...nuevo[index], is_completed: !nuevo[index].is_completed };
    toggleChecklist({ actividadId: actividad.id, puntoId, checklist: nuevo });
  };

  const handleToggleMiembroCheck = (miembroId: string, itemIdx: number) => {
    const miembro = miembros.find((m) => m.id === miembroId);
    if (!miembro) return;
    const nuevas = [...(miembro.asignaciones || [])];
    nuevas[itemIdx] = { ...nuevas[itemIdx], is_complete: !nuevas[itemIdx].is_complete };
    toggleMiembroChecklist({ miembroId, puntoId, asignaciones: nuevas });
  };

  const estadoBadgeClass =
    actividad.estado === 'Completado'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
      : actividad.estado === 'En Proceso'
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {indice}
            </span>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{actividad.titulo}</h3>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoBadgeClass}`}>
              {actividad.fecha_confirmacion || actividad.estado === 'Completado' ? (
                <CheckCircle2 size={11} />
              ) : (
                <Clock size={11} />
              )}
              {actividad.estado}
            </span>
            {actividad.estado === 'Completado' && (
              actividad.revisado_por ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 size={11} />
                  Revisado por {actividad.revisado_por.nombre}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  <Clock size={11} />
                  Pendiente de revisión
                </span>
              )
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Crown size={13} className="text-amber-500" /> <span className="font-semibold text-zinc-800 dark:text-zinc-200">{actividad.encargado_nombre}</span> (Encargado)
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {formatearFechaActividad(actividad.fecha_limite)}
              {retrasoText && (
                <span className="text-red-500 dark:text-red-400 font-semibold ml-1">
                  ⚠️ {retrasoText}
                </span>
              )}
            </span>
          </div>
        </div>

        {puedeEditar && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onEditar(actividad)}
              className="cursor-pointer rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#0066cc] dark:hover:bg-zinc-800 dark:hover:text-blue-400"
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => onEliminar(actividad)}
              className="cursor-pointer rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        {actividad.descripcion && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Descripción</p>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{actividad.descripcion}</p>
          </div>
        )}

        {/* Barra de progreso global */}
        {(totalGlobal > 0 || esGrupal) && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/50 space-y-2.5">
            <div className="flex justify-between items-end">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {esGrupal ? 'Progreso Global' : 'Progreso de la actividad'}
              </p>
              <span className={`text-xs font-bold ${porcentajeGlobal === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {completosGlobal}/{totalGlobal} · {porcentajeGlobal}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getColorBarra(porcentajeGlobal)}`}
                style={{ width: `${porcentajeGlobal}%` }}
              />
            </div>

            {/* Sub-barras para actividades grupales */}
            {esGrupal && (
              <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                <div>
                  <div className="flex justify-between items-start sm:items-center text-[11px] mb-1 gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 font-medium text-zinc-700 dark:text-zinc-300 min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <Crown size={12} className="text-amber-500 shrink-0" />
                        <span className="truncate">{actividad.encargado_nombre}</span>
                        <span className="text-blue-500 text-[10px] shrink-0">(Encargado)</span>
                      </div>
                      <div className="sm:ml-1 shrink-0">
                        {renderConfirmacion(actividad.fecha_confirmacion)}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-zinc-500 shrink-0 mt-0.5 sm:mt-0">
                      {completadosEncargado}/{totalEncargado}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getColorBarra(porcentajeEncargado)}`}
                      style={{ width: `${porcentajeEncargado}%` }}
                    />
                  </div>
                </div>

                {miembros.map((m) => {
                  const mTotal = m.asignaciones?.length || 0;
                  const mComp = m.asignaciones?.filter((a) => a.is_complete).length || 0;
                  const mPct = mTotal === 0 ? 0 : Math.round((mComp / mTotal) * 100);
                  return (
                    <div key={m.id}>
                      <div className="flex justify-between items-start sm:items-center text-[11px] mb-1 gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 font-medium text-zinc-700 dark:text-zinc-300 min-w-0 flex-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <User size={12} className="text-purple-500 shrink-0" />
                            <span className="truncate">{m.nombre_usuario}</span>
                          </div>
                          <div className="sm:ml-1 shrink-0">
                            {renderConfirmacion(m.fecha_confirmacion)}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-500 shrink-0 mt-0.5 sm:mt-0">
                          {mComp}/{mTotal}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getColorBarra(mPct)}`}
                          style={{ width: `${mPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pestañas para Grupal vs Checklist Simple */}
        {esGrupal ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
            <div className="flex justify-start sm:justify-center gap-6 mb-4 overflow-x-auto border-b border-zinc-200 dark:border-zinc-700 px-2 pb-2 scrollbar-none w-full">
              {tabs.map((t) => {
                const isActive = tabActivo === t.id;
                const isEncargadoTab = t.id === 'encargado';
                const activeColorClass = isEncargadoTab
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400';

                return (
                  <button
                    key={t.id}
                    onClick={() => setTabActivo(t.id)}
                    className={`pb-2 text-xs font-semibold whitespace-nowrap flex flex-col items-center shrink-0 transition-colors ${
                      isActive ? activeColorClass : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                    }`}
                  >
                    <span className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                      {t.rol}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isEncargadoTab ? (
                        <Crown size={14} className={isActive ? 'text-amber-500' : 'opacity-40'} />
                      ) : (
                        <User size={14} className={isActive ? 'text-purple-500' : 'opacity-40'} />
                      )}
                      <span>{t.label}</span>
                      {t.confirmedAt && <CheckCircle2 size={12} className="text-emerald-500" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {tabActivo === 'encargado' ? (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <CheckSquare size={14} /> Actividades del Encargado ({totalEncargado})
                </p>
                {checklist.length > 0 ? (
                  <ul className="space-y-1.5">
                    {checklist.map((item, i) => (
                      <li
                        key={i}
                        onClick={() => handleToggleGlobalCheck(i)}
                        className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/70 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700/50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          readOnly
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className={cn(item.is_completed && 'line-through text-zinc-400 dark:text-zinc-500')}>
                          {item.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No hay entregables para el encargado.</p>
                )}
              </div>
            ) : (
              activeMember && (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <CheckSquare size={14} /> Actividades de {activeMember.nombre_usuario} ({(activeMember.asignaciones || []).length})
                  </p>
                  {(activeMember.asignaciones || []).length > 0 ? (
                    <ul className="space-y-1.5">
                      {activeMember.asignaciones.map((asig, i) => (
                        <li
                          key={i}
                          onClick={() => handleToggleMiembroCheck(activeMember.id, i)}
                          className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/70 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700/50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={asig.is_complete}
                            readOnly
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span className={cn(asig.is_complete && 'line-through text-zinc-400 dark:text-zinc-500')}>
                            {asig.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No hay tareas individuales asignadas.</p>
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          checklist.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <CheckSquare size={14} /> Entregables ({completadosEncargado}/{totalEncargado})
              </p>
              <ul className="space-y-1.5">
                {checklist.map((item, i) => (
                  <li
                    key={i}
                    onClick={() => handleToggleGlobalCheck(i)}
                    className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      readOnly
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className={cn(item.is_completed && 'line-through text-zinc-400 dark:text-zinc-500')}>
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {/* Sección de finalización y revisión */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
          {actividad.estado === 'Completado' && actividad.actualizado_en && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={13} />
              Completada el: {formatearFechaActividad(actividad.actualizado_en)}
            </p>
          )}

          {actividad.revisado_por ? (
            <div className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-emerald-700 dark:text-emerald-400 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Revisado por {actividad.revisado_por.nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium opacity-80 text-[11px]">
                  {formatearFechaActividad(actividad.revisado_por.fecha)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {actividad.estado !== 'Completado' && (
                esAsignadoAMi && onFinalizar ? (
                  <button
                    type="button"
                    onClick={() => onFinalizar(actividad)}
                    disabled={cargandoAccionId === actividad.id}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {cargandoAccionId === actividad.id ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Finalizar Actividad</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex justify-center items-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 select-none cursor-not-allowed"
                    title="Pendiente de finalizar por la persona asignada"
                  >
                    <Clock size={15} className="opacity-60" />
                    <span>Pendiente</span>
                  </div>
                )
              )}
              {actividad.estado === 'Completado' && puedeEditar && onMarcarRevisado && (
                <button
                  type="button"
                  onClick={() => onMarcarRevisado(actividad)}
                  disabled={cargandoAccionId === actividad.id}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {cargandoAccionId === actividad.id ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Guardando revisión...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Marcar como Revisado</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Componente Principal del Modal ──────────────────────────
export default function ActividadesPuntoModal({
  isOpen,
  onClose,
  punto,
  actComudeId,
  canManage,
}: ActividadesPuntoModalProps) {
  const [vista, setVista] = useState<Vista>('lista');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descripcionAnterior, setDescripcionAnterior] = useState('');
  const [dueDate, setDueDate] = useState(fechaPorDefecto());
  const [assignedTo, setAssignedTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [checklist, setChecklist] = useState<{ title: string; is_completed: boolean }[]>([]);
  const [checklistInput, setChecklistInput] = useState('');
  const [miembros, setMiembros] = useState<{ userId: string; nombre: string; asignaciones: { title: string; is_complete: boolean }[] }[]>([]);

  // Mention State
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState<number>(0);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Queries & Mutations
  const { data: actividades = [], isLoading } = useActividadesDePunto(punto?.id ?? null, isOpen);
  const { data: usuarios = [] } = useUsuariosAsignablesMunicipio(isOpen);
  const { mutateAsync: crearActividad, isPending: creando } = useCrearActividadPunto();
  const { mutateAsync: editarActividad, isPending: editando } = useEditarActividadPunto();
  const { mutateAsync: eliminarActividad } = useEliminarActividadPunto();
  const { mutateAsync: marcarRevisado } = useMarcarRevisadoPorComude();
  const { mutateAsync: desmarcarRevisado } = useDesmarcarRevisadoPorComude();
  const { mutateAsync: finalizarActividad } = useFinalizarActividadPunto();
  const [cargandoAccionId, setCargandoAccionId] = useState<string | null>(null);

  const { effectiveRole } = useUserContext();
  const isSuper = effectiveRole === 'super';

  const usuariosDisponibles = useMemo(() => {
    if (isSuper) return usuarios;
    return usuarios.filter((u) => u.rol !== 'super');
  }, [usuarios, isSuper]);

  const usuariosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return usuariosDisponibles;
    return usuariosDisponibles.filter((u) => u.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [usuariosDisponibles, searchTerm]);

  const usuariosParaMencion = useMemo(() => {
    if (!mentionSearchTerm.trim()) return [];
    return usuariosDisponibles.filter(
      (u) =>
        u.nombre.toLowerCase().includes(mentionSearchTerm.toLowerCase()) &&
        u.id !== assignedTo
    );
  }, [usuariosDisponibles, mentionSearchTerm, assignedTo]);

  const limpiarFormulario = () => {
    setTitle('');
    setDescription('');
    setDescripcionAnterior('');
    setDueDate(fechaPorDefecto());
    setAssignedTo('');
    setSearchTerm('');
    setShowDropdown(false);
    setShowMentionDropdown(false);
    setMentionSearchTerm('');
    setChecklist([]);
    setChecklistInput('');
    setMiembros([]);
    setEditandoId(null);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setVista('lista');
      limpiarFormulario();
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const abrirNueva = () => {
    limpiarFormulario();
    setVista('formulario');
  };

  const abrirEdicion = (act: ActividadPunto) => {
    setEditandoId(act.id);
    setTitle(act.titulo);
    setDescription('');
    setDescripcionAnterior(act.descripcion || '');
    setDueDate(formatearFechaInput(act.fecha_limite));
    setAssignedTo(act.encargado_id);
    setSearchTerm(act.encargado_nombre);
    setChecklist(act.checklist || []);
    setMiembros(
      (act.miembros || []).map((m) => ({
        userId: m.usuario_id,
        nombre: m.nombre_usuario,
        asignaciones: m.asignaciones || [],
      }))
    );
    setVista('formulario');
  };

  const seleccionarUsuario = (userId: string, nombre: string) => {
    setAssignedTo(userId);
    setSearchTerm(nombre);
    setShowDropdown(false);
    setMiembros((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const renderHighlightedText = () => {
    if (!description) return null;

    if (miembros.length === 0) {
      return description;
    }

    const sortedMiembros = [...miembros].sort((a, b) => b.nombre.length - a.nombre.length);
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = sortedMiembros.map((m) => `@${escapeRegExp(m.nombre)}`);
    const regex = new RegExp(`(${names.join('|')})`, 'g');

    const parts = description.split(regex);

    return parts.map((part, i) => {
      if (sortedMiembros.some((m) => `@${m.nombre}` === part)) {
        return (
          <span key={i} className="text-blue-500 dark:text-blue-400">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      const el = e.target as HTMLTextAreaElement;
      const cursor = el.selectionStart;
      if (cursor === el.selectionEnd && cursor > 0) {
        const textBeforeCursor = description.slice(0, cursor);
        for (const m of miembros) {
          const mentionText = `@${m.nombre}`;
          if (textBeforeCursor.endsWith(mentionText)) {
            e.preventDefault();
            const newDescription = description.slice(0, cursor - mentionText.length) + description.slice(cursor);
            setDescription(newDescription);
            setMiembros((prev) => prev.filter((x) => x.userId !== m.userId));
            setTimeout(() => {
              el.setSelectionRange(cursor - mentionText.length, cursor - mentionText.length);
            }, 0);
            return;
          }
        }
      }
    }

    if (showMentionDropdown && usuariosParaMencion.length === 1) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        insertMention(usuariosParaMencion[0]);
      }
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);

    setMiembros((prev) => prev.filter((m) => val.includes(`@${m.nombre}`)));

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^@\n]*)$/);
    if (mentionMatch && mentionMatch[1].length >= 3) {
      setShowMentionDropdown(true);
      setMentionSearchTerm(mentionMatch[1]);
      setMentionPosition(cursor - mentionMatch[1].length);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (user: UsuarioAsignablePunto) => {
    const val = description;
    const cursor = mentionPosition;
    const beforeAt = val.slice(0, cursor - 1);
    const textAfterCursor = val.slice(cursor + mentionSearchTerm.length);

    const newDescription = `${beforeAt}@${user.nombre} ${textAfterCursor}`;
    setDescription(newDescription);
    setShowMentionDropdown(false);

    if (!miembros.some((m) => m.userId === user.id) && user.id !== assignedTo) {
      setMiembros((prev) => [...prev, { userId: user.id, nombre: user.nombre, asignaciones: [] }]);
    }
  };

  const agregarChecklist = () => {
    if (!checklistInput.trim()) return;
    setChecklist([...checklist, { title: checklistInput.trim(), is_completed: false }]);
    setChecklistInput('');
  };

  const quitarChecklist = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const guardar = async () => {
    if (!punto) return;
    if (!title.trim() || !dueDate) {
      toast.warn('Completa el título y la fecha límite de la actividad.');
      return;
    }
    if (!assignedTo) {
      toast.warn('Selecciona a quién se le asigna la actividad.');
      return;
    }

    try {
      const dueIso = new Date(dueDate).toISOString();
      const esGrupal = miembros.length > 0;

      if (editandoId) {
        const actual = actividades.find((a) => a.id === editandoId);
        const cambios: string[] = [];
        if (actual) {
          if (formatearFechaInput(actual.fecha_limite) !== dueDate) {
            if (new Date(dueDate) < new Date()) {
              toast.warn('La fecha límite no puede quedar en el pasado.');
              return;
            }
            cambios.push(
              `Fecha límite: ${formatearFechaBitacora(actual.fecha_limite)} → ${formatearFechaBitacora(dueIso)}`,
            );
          }
        }

        const descripcionFinal = componerBitacoraActividad({
          nota: description,
          anterior: descripcionAnterior,
          cambios,
        });

        await editarActividad({
          actividadId: editandoId,
          puntoId: punto.id,
          input: {
            titulo: title.trim(),
            descripcion: descripcionFinal || null,
            fechaLimite: dueIso,
            encargadoId: actual?.encargado_id || assignedTo,
            miembros: esGrupal ? miembros.map((m) => ({ userId: m.userId, asignaciones: m.asignaciones })) : undefined,
          },
        });
        toast.success('Actividad actualizada.');
      } else {
        await crearActividad({
          puntoId: punto.id,
          titulo: title.trim(),
          descripcion: description.trim() || null,
          fechaLimite: dueIso,
          encargadoId: assignedTo,
          checklist,
          miembros: esGrupal ? miembros.map((m) => ({ userId: m.userId, asignaciones: m.asignaciones })) : undefined,
        });
        notifyActividadPendienteRefresh();
        toast.success('Actividad asignada.');
      }
      limpiarFormulario();
      setVista('lista');
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar la actividad.');
    }
  };

  const eliminar = async (act: ActividadPunto) => {
    if (!punto) return;
    const res = await Swal.fire({
      title: '¿Eliminar actividad?',
      text: `Se eliminará "${act.titulo}". Esta acción no se puede revertir.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        container: 'z-[9999]',
      },
    });

    if (res.isConfirmed) {
      try {
        await eliminarActividad({ actividadId: act.id, puntoId: punto.id });
        toast.success('Actividad eliminada.');
      } catch (e: any) {
        toast.error(e.message || 'Error al eliminar.');
      }
    }
  };

  const handleMarcarRevisado = async (act: ActividadPunto) => {
    try {
      setCargandoAccionId(act.id);
      const res = await marcarRevisado({ actividadId: act.id, puntoId: punto?.id });
      if (!res.success) {
        toast.error(res.error || 'Error al marcar como revisada.');
        return;
      }
      toast.success('Actividad marcada como revisada por COMUDE.');
    } catch (e: any) {
      toast.error(e.message || 'Error al marcar como revisada.');
    } finally {
      setCargandoAccionId(null);
    }
  };

  const handleDesmarcarRevisado = async (act: ActividadPunto) => {
    try {
      setCargandoAccionId(act.id);
      const res = await desmarcarRevisado({ actividadId: act.id, puntoId: punto?.id });
      if (!res.success) {
        toast.error(res.error || 'Error al desmarcar revisión.');
        return;
      }
      toast.success('Revisión desmarcada.');
    } catch (e: any) {
      toast.error(e.message || 'Error al desmarcar revisión.');
    } finally {
      setCargandoAccionId(null);
    }
  };

  const handleFinalizar = async (act: ActividadPunto) => {
    try {
      setCargandoAccionId(act.id);
      const res = await finalizarActividad({ actividadId: act.id, puntoId: punto?.id });
      if (!res.success) {
        toast.error(res.error || 'Error al finalizar actividad.');
        return;
      }
      toast.success('Actividad finalizada.');
    } catch (e: any) {
      toast.error(e.message || 'Error al finalizar actividad.');
    } finally {
      setCargandoAccionId(null);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex flex-col sm:items-center sm:justify-center sm:p-4">
          {/* Backdrop con blur que cubre toda la pantalla incluyendo el header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 sm:bg-zinc-700/20 sm:backdrop-blur-sm sm:dark:bg-zinc-900/60"
            onClick={onClose}
          />

          {/* Panel Flotante Centrado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-800 sm:h-auto sm:max-h-[min(90vh,52rem)] sm:w-full sm:max-w-2xl sm:rounded-3xl sm:border sm:border-zinc-200 sm:shadow-2xl dark:sm:border-zinc-700 dark:sm:shadow-black/70"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-zinc-700 sm:rounded-t-3xl sm:px-5 sm:pb-2.5 sm:pt-4">
              <div className="min-w-0 pr-1">
                <h2 className="text-base font-semibold leading-snug text-[#0066cc] line-clamp-1 dark:text-blue-400 sm:text-lg">
                  Actividades asignadas
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

        {/* Contenido */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] custom-scrollbar sm:px-5 sm:pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : vista === 'lista' ? (
            <div className="flex w-full flex-col gap-4">
              {canManage && (
                <button
                  onClick={abrirNueva}
                  className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-200 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                >
                  <Plus size={18} /> Nueva actividad
                </button>
              )}

              {actividades.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                  No hay actividades asignadas para este punto.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {actividades.map((actividad, index) => (
                    <li key={actividad.id}>
                      <DetalleActividadPanel
                        actividad={actividad}
                        indice={index + 1}
                        puntoId={punto?.id || ''}
                        puedeEditar={canManage}
                        onEditar={abrirEdicion}
                        onEliminar={eliminar}
                        onMarcarRevisado={handleMarcarRevisado}
                        onDesmarcarRevisado={handleDesmarcarRevisado}
                        onFinalizar={handleFinalizar}
                        cargandoAccionId={cargandoAccionId}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* ─── VISTA FORMULARIO ─── */
            <div className="w-full space-y-4">
              <button
                onClick={() => {
                  limpiarFormulario();
                  setVista('lista');
                }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft size={16} /> Volver a la lista
              </button>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Título de la actividad
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <Calendar size={14} /> Fecha límite
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => {
                    const valor = e.target.value;
                    if (editandoId) {
                      const actual = actividades.find((a) => a.id === editandoId);
                      const original = actual ? formatearFechaInput(actual.fecha_limite) : '';
                      if (valor !== original && new Date(valor) < new Date()) {
                        toast.warn('La fecha límite no puede quedar en el pasado.');
                        return;
                      }
                    }
                    setDueDate(valor);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
                />
              </div>

              <div className="space-y-2 relative">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <User size={14} /> {editandoId ? 'Asignado a' : 'Asignar a'}
                </label>
                {editandoId ? (
                  <input
                    type="text"
                    value={searchTerm}
                    readOnly
                    disabled
                    className="w-full cursor-not-allowed p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl text-base text-gray-500 dark:text-gray-400 opacity-70"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                        if (!e.target.value.trim()) setAssignedTo('');
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      placeholder="Escribe un nombre..."
                      className="w-full p-3 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100"
                    />
                    {showDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {usuariosFiltrados.length > 0 ? (
                          usuariosFiltrados.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => seleccionarUsuario(u.id, u.nombre)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 text-sm transition-colors border-b border-gray-50 dark:border-neutral-700/50 last:border-0"
                            >
                              {u.nombre}
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-gray-400 text-xs italic">
                            No se encontraron usuarios
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 relative">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <AlignLeft size={14} /> {editandoId ? 'Nueva nota' : 'Descripción'}
                </label>
                <div className="relative">
                  <div
                    ref={backdropRef}
                    className="absolute inset-0 border border-transparent p-3 sm:p-4 text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words overflow-hidden pointer-events-none rounded-xl"
                    style={{
                      letterSpacing: 'normal',
                      wordSpacing: 'normal',
                      color: 'var(--tw-text-opacity) == 1 ? currentColor : "transparent"',
                    }}
                    aria-hidden="true"
                  >
                    <div className={`w-full h-full text-gray-700 dark:text-gray-100 ${!description ? 'opacity-0' : 'opacity-100'}`}>
                      {renderHighlightedText()}
                      {description.endsWith('\n') ? <br /> : null}
                    </div>
                  </div>
                  <textarea
                    value={description}
                    onChange={handleDescriptionChange}
                    onKeyDown={handleKeyDown}
                    onScroll={handleScroll}
                    placeholder={
                      editandoId
                        ? 'Escribe una nueva nota para la bitácora... (Usa @ para mencionar usuarios)'
                        : 'Detalles de la actividad... (Usa @ para mencionar usuarios)'
                    }
                    rows={4}
                    className={`w-full p-3 sm:p-4 bg-transparent border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words placeholder-gray-400 dark:placeholder-gray-500 resize-none relative z-10 custom-scrollbar ${description ? 'text-transparent' : 'text-gray-700 dark:text-gray-100'}`}
                    style={{ caretColor: '#3b82f6', letterSpacing: 'normal', wordSpacing: 'normal' }}
                  />
                  {showMentionDropdown && usuariosParaMencion.length > 0 && (
                    <div className="absolute z-50 w-full bottom-full mb-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto ring-1 ring-black/5 dark:ring-white/10">
                      {usuariosParaMencion.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertMention(u);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100 text-sm border-b border-slate-200 dark:border-slate-700/50 last:border-0 transition-colors"
                        >
                          {u.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {editandoId ? (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      Al guardar se agrega sola la fecha y hora actual, como bitácora.
                    </p>
                    {descripcionAnterior.trim() ? (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/70">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Bitácora
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {descripcionAnterior}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              {!editandoId && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <CheckSquare size={14} /> Lista de pendientes
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={checklistInput}
                      onChange={(e) => setChecklistInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          agregarChecklist();
                        }
                      }}
                      className="flex-1 p-3 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={agregarChecklist}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors shrink-0"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  {checklist.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {checklist.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 p-2.5 rounded-lg border border-gray-100 dark:border-neutral-700"
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">
                            • {item.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => quitarChecklist(idx)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="button"
                onClick={guardar}
                disabled={creando || editando}
                className="h-12 w-full cursor-pointer rounded-xl bg-zinc-200 text-sm font-semibold text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
              >
                {creando || editando ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} /> Guardando...
                  </span>
                ) : editandoId ? (
                  'Guardar cambios'
                ) : (
                  'Asignar actividad'
                )}
              </Button>
            </div>
          )}
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
