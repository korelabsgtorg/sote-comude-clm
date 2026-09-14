'use client';

import React, { Fragment, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
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
  MessageSquare,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { ActividadConcejo, Tarea, UsuarioAsignable } from '../../lib/esquemas';
import {
  obtenerActividadesDePunto,
  obtenerUsuariosAsignables,
  crearActividadConcejo,
  editarActividadConcejo,
  eliminarActividadConcejo,
} from '../lib/actividades';
import { componerBitacoraActividad, formatearFechaBitacora } from '../lib/bitacora';
import GestorArchivos from '@/components/tareas/GestorArchivos';
import type { ArchivoAdjunto } from '@/components/tareas/types';
import VerPDF from '@/components/files/verPDF';

interface ActividadesAsignadasProps {
  isOpen: boolean;
  onClose: (hasChanged: boolean) => void;
  tarea: Tarea;
  puedeEditar: boolean;
}

interface ChecklistItem {
  title: string;
  is_completed: boolean;
}

type Vista = 'lista' | 'formulario';

const fechaPorDefecto = () => {
  const d = new Date();
  d.setHours(16, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T16:00`;
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

const formatearConfirmacion = (iso: string) => `Confirmada el: ${formatearFechaActividad(iso)}`;

const getNombreCorto = (nombreCompleto: string | undefined | null) => {
  if (!nombreCompleto) return 'Sin nombre';
  const partes = nombreCompleto.trim().split(/\s+/);
  const total = partes.length;
  if (total === 1) return partes[0];
  const primerNombre = partes[0];
  let indexApellido = 1;
  const p1 = partes[1] ? partes[1].toLowerCase() : '';
  const p2 = partes[2] ? partes[2].toLowerCase() : '';
  const conectores = ['de', 'del', 'la', 'las', 'los', 'san', 'da', 'di', 'van', 'von', 'y'];
  const sufijosNombreCompuesto = ['jesús', 'jesus', 'carmen', 'pilar', 'rocío', 'rocio', 'luz', 'maría', 'maria', 'ángeles', 'angeles', 'fatima', 'fátima'];
  if (total > 3 && (p1 === 'de' || p1 === 'del') && sufijosNombreCompuesto.includes(p2)) { indexApellido = 3; } 
  else if (total >= 3) { if (!conectores.includes(p1)) { indexApellido = 2; } }
  const partesApellido = [];
  for (let i = indexApellido; i < total; i++) {
      const palabra = partes[i];
      partesApellido.push(palabra);
      if (!conectores.includes(palabra.toLowerCase())) { break; }
  }
  return `${primerNombre} ${partesApellido.join(' ')}`;
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

const progresoChecklist = (checklist: ActividadConcejo['checklist']) => {
  const items = checklist || [];
  const total = items.length;
  const completados = items.filter((item) => item.is_completed).length;
  const porcentaje = total === 0 ? 0 : Math.round((completados / total) * 100);
  return { items, total, completados, porcentaje };
};

const getColorBarra = (pct: number) => {
  if (pct === 100) return 'bg-emerald-500';
  if (pct > 75) return 'bg-yellow-300';
  if (pct > 50) return 'bg-yellow-500';
  if (pct > 25) return 'bg-orange-500';
  if (pct > 0) return 'bg-red-600';
  return 'bg-zinc-200 dark:bg-zinc-700';
};

function DetalleActividadPanel({
  actividad,
  indice,
  acciones,
  onVerPdf,
  onCompletar,
  onMarcarRevisado,
  cargandoAccion,
  onToggleChecklist,
}: {
  actividad: ActividadConcejo;
  indice?: number;
  acciones?: ReactNode;
  onVerPdf?: (archivo: ArchivoAdjunto) => void;
  onCompletar?: (id: string) => void;
  onMarcarRevisado?: (id: string) => void;
  cargandoAccion?: string | null;
  onToggleChecklist?: (taskId: string, newChecklist: any[]) => void;
}) {
  const [tabActivo, setTabActivo] = useState<string>('encargado');
  const miembros = actividad.miembros || [];
  const esGrupal = miembros.length > 0;

  const { items: checklist, total: totalEncargado, completados: completadosEncargado, porcentaje: porcentajeEncargado } = progresoChecklist(actividad.checklist);

  const totalMiembros = miembros.reduce((s, m) => s + (m.asignaciones?.length || 0) + 1, 0);
  const completadosMiembros = miembros.reduce((s, m) => s + (m.asignaciones?.filter((a) => a.is_complete).length || 0) + (m.completed_at ? 1 : 0), 0);
  const totalGlobal = totalEncargado + (esGrupal ? totalMiembros : 0);
  const completosGlobal = completadosEncargado + (esGrupal ? completadosMiembros : 0);
  const porcentajeGlobal = totalGlobal === 0 ? 0 : Math.round((completosGlobal / totalGlobal) * 100);

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

  const retrasoText = formatRetraso(actividad.due_date, actividad.updated_at);
  const badge = estadoBadge(actividad);

  const tabs = useMemo(() => {
    if (!esGrupal) return [];
    return [
      {
        id: 'encargado',
        label: getNombreCorto(actividad.assignee_nombre) || 'Encargado',
        confirmedAt: actividad.confirmed_at,
        completedAt: actividad.status === 'Completado',
        rol: 'Encargado',
      },
      ...miembros.map((m) => ({
        id: m.id,
        label: getNombreCorto(m.nombre_usuario) || 'Miembro',
        confirmedAt: m.confirmed_at,
        completedAt: !!m.completed_at,
        rol: 'Miembro',
      })),
    ];
  }, [esGrupal, actividad.assignee_nombre, actividad.status, actividad.confirmed_at, miembros]);

  const activeMember = miembros.find((m) => m.id === tabActivo);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {indice !== undefined && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {indice}
              </span>
            )}
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{actividad.title}</h3>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.clase}`}>
              {actividad.confirmed_at || actividad.status === 'Completado' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
              {badge.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Crown size={13} className="text-amber-500" /> <span className="font-semibold">{actividad.assignee_nombre}</span> (Encargado)
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {formatearFechaActividad(actividad.due_date)}
              {retrasoText && (
                <span className="text-red-500 dark:text-red-400 font-semibold ml-1">
                  {actividad.status === 'Completado' ? `⚠️ Se completó con un tiempo tardío de: ${retrasoText.replace(/^Atrasada por /i, '')}` : `⚠️ ${retrasoText}`}
                </span>
              )}
            </span>
          </div>
        </div>
        {acciones ? <div className="flex shrink-0 items-center gap-1">{acciones}</div> : null}
      </div>

      <div className="space-y-4 p-4">
        {actividad.description && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Descripción</p>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{actividad.description}</p>
          </div>
        )}

        {/* Barra de progreso global / total */}
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

            {/* Sub-barras individuales para cada miembro en actividades grupales */}
            {esGrupal && (
              <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                {/* Barra Encargado */}
                <div>
                  <div className="flex justify-between items-start sm:items-center text-[11px] mb-1 gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 font-medium text-zinc-700 dark:text-zinc-300 min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <Crown size={12} className="text-amber-500 shrink-0" />
                        <span className="truncate">{actividad.assignee_nombre}</span>
                        <span className="text-blue-500 text-[10px] shrink-0">(Encargado)</span>
                      </div>
                      <div className="sm:ml-1 shrink-0">
                        {renderConfirmacion(actividad.confirmed_at)}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-zinc-500 shrink-0 mt-0.5 sm:mt-0">{completadosEncargado}/{totalEncargado}</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getColorBarra(porcentajeEncargado)}`}
                      style={{ width: `${porcentajeEncargado}%` }}
                    />
                  </div>
                </div>

                {/* Barras de cada miembro */}
                {miembros.map((m) => {
                  const mTotal = (m.asignaciones?.length || 0) + 1;
                  const mComp = (m.asignaciones?.filter((a) => a.is_complete).length || 0) + (m.completed_at ? 1 : 0);
                  const mPct = Math.round((mComp / mTotal) * 100);
                  return (
                    <div key={m.id}>
                      <div className="flex justify-between items-start sm:items-center text-[11px] mb-1 gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 font-medium text-zinc-700 dark:text-zinc-300 min-w-0 flex-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <User size={12} className="text-purple-500 shrink-0" />
                            <span className="truncate">{m.nombre_usuario}</span>
                          </div>
                          <div className="sm:ml-1 shrink-0">
                            {renderConfirmacion(m.confirmed_at)}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-500 shrink-0 mt-0.5 sm:mt-0">{mComp}/{mTotal}</span>
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

        {/* ACTIVIDAD GRUPAL: Tabs de Participantes y Contenido */}
        {esGrupal ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
            {/* Tabs */}
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
                      isActive
                        ? activeColorClass
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
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

            {/* Contenido del Tab Activo */}
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
                        onClick={() => {
                          if (!onToggleChecklist) return;
                          const newChecklist = [...checklist];
                          newChecklist[i].is_completed = !newChecklist[i].is_completed;
                          onToggleChecklist(actividad.id, newChecklist);
                        }}
                        className={`flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/70 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700/50 ${onToggleChecklist ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800' : ''}`}
                      >
                        {/* Icono de Checkbox idéntico a TareaChecklist */}
                        <div 
                          className={`
                            min-w-[20px] w-[20px] h-[20px] rounded flex items-center justify-center border shrink-0
                            transition-all duration-200 ease-in-out transform
                            ${!onToggleChecklist ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-75 active:bg-zinc-200'}
                            ${item.is_completed 
                                ? 'bg-green-500 border-green-500 shadow-sm rotate-0' 
                                : 'bg-white dark:bg-neutral-800 border-zinc-300 dark:border-neutral-600 hover:border-blue-400 dark:hover:border-blue-500 rotate-0'
                            }
                          `}
                        >
                            <Check 
                                size={14} 
                                className={`text-white transition-all duration-200 ${item.is_completed ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} 
                                strokeWidth={4} 
                            />
                        </div>
                        <span className={item.is_completed ? 'line-through text-zinc-400' : ''}>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-2">Sin tareas secundarias para el encargado.</p>
                )}
              </div>
            ) : activeMember ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    <User size={14} /> Actividades de {activeMember.nombre_usuario}
                  </p>
                  {activeMember.completed_at && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> Completado el {formatearFechaActividad(activeMember.completed_at)}
                    </span>
                  )}
                </div>

                {activeMember.asignaciones && activeMember.asignaciones.length > 0 ? (
                  <ul className="space-y-1.5">
                    {activeMember.asignaciones.map((asig, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/70 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                        {asig.is_complete ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        ) : (
                          <Clock size={14} className="shrink-0 text-zinc-400" />
                        )}
                        <span>{asig.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-2">Sin tareas secundarias asignadas individualmente.</p>
                )}

                {activeMember.comentario && (
                  <div className="mt-3 p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300">
                    <p className="text-[10px] font-bold uppercase text-zinc-400 mb-0.5 flex items-center gap-1">
                      <MessageSquare size={11} /> Comentario final
                    </p>
                    <p className="italic">{activeMember.comentario}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          /* ACTIVIDAD INDIVIDUAL: Lista de pendientes tradicional */
          totalEncargado > 0 && (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <CheckSquare size={14} /> Lista de pendientes
                </p>
                <span className={`text-xs font-bold ${porcentajeEncargado === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                  {completadosEncargado}/{totalEncargado} · {porcentajeEncargado}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${porcentajeEncargado === 100 ? 'bg-emerald-500' : 'bg-[#0066cc] dark:bg-blue-400'}`}
                  style={{ width: `${porcentajeEncargado}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {checklist.map((item, i) => (
                  <li 
                    key={i} 
                    onClick={() => {
                      if (!onToggleChecklist) return;
                      const newChecklist = [...checklist];
                      newChecklist[i].is_completed = !newChecklist[i].is_completed;
                      onToggleChecklist(actividad.id, newChecklist);
                    }}
                    className={`flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 p-2 rounded-lg border border-transparent ${onToggleChecklist ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-100 dark:hover:border-zinc-700/50' : ''}`}
                  >
                    {/* Icono de Checkbox idéntico a TareaChecklist */}
                    <div 
                      className={`
                        min-w-[20px] w-[20px] h-[20px] rounded flex items-center justify-center border shrink-0
                        transition-all duration-200 ease-in-out transform
                        ${!onToggleChecklist ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-75 active:bg-zinc-200'}
                        ${item.is_completed 
                            ? 'bg-green-500 border-green-500 shadow-sm rotate-0' 
                            : 'bg-white dark:bg-neutral-800 border-zinc-300 dark:border-neutral-600 hover:border-blue-400 dark:hover:border-blue-500 rotate-0'
                        }
                      `}
                    >
                        <Check 
                            size={14} 
                            className={`text-white transition-all duration-200 ${item.is_completed ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} 
                            strokeWidth={4} 
                        />
                    </div>
                    <span className={item.is_completed ? 'line-through text-zinc-400' : ''}>{item.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {/* Confirmación */}
        {actividad.confirmed_at ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} />
            {formatearConfirmacion(actividad.confirmed_at)}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <Clock size={14} />
            Pendiente de confirmación por el asignado
          </p>
        )}

        {/* Botones de acción y badge de revisión */}
        <div className="pt-2">
          {actividad.revisado_por ? (
            <div className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-center text-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={16} />
                <span>
                  Revisado por {actividad.revisado_por.nombre}
                </span>
              </div>
              <span className="font-medium opacity-80 text-[11px] sm:ml-1">
                {formatearFechaActividad(actividad.revisado_por.fecha)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {actividad.status !== 'Completado' && onCompletar && (
                <button
                  onClick={() => onCompletar(actividad.id)}
                  disabled={cargandoAccion === actividad.id}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cargandoAccion === actividad.id ? 'Procesando...' : 'Finalizar Actividad'}
                </button>
              )}
              {actividad.status === 'Completado' && !actividad.revisado_por && onMarcarRevisado && (
                <button
                  onClick={() => onMarcarRevisado(actividad.id)}
                  disabled={cargandoAccion === actividad.id}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cargandoAccion === actividad.id ? 'Procesando...' : 'Marcar como Revisado'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Archivos adjuntos */}
        <GestorArchivos
          tareaId={actividad.id}
          archivosIniciales={actividad.archivos ?? null}
          esLectura
          onVerPdf={onVerPdf}
        />
      </div>
    </article>
  );
}

const estadoBadge = (actividad: ActividadConcejo) => {
  if (actividad.status === 'Completado') {
    return { label: 'Completado', clase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
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

export default function ActividadesAsignadas({ isOpen, onClose, tarea, puedeEditar }: ActividadesAsignadasProps) {
  const [actividades, setActividades] = useState<ActividadConcejo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAsignable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [hasChanged, setHasChanged] = useState(false);
  const [vista, setVista] = useState<Vista>('lista');
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descripcionAnterior, setDescripcionAnterior] = useState('');
  const [dueDate, setDueDate] = useState(fechaPorDefecto);
  const [assignedTo, setAssignedTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [checklistInput, setChecklistInput] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [pdfViendo, setPdfViendo] = useState<ArchivoAdjunto | null>(null);
  const [cargandoAccion, setCargandoAccion] = useState<string | null>(null);

  // Menciones @
  const [miembros, setMiembros] = useState<{ userId: string; nombre: string; asignaciones: any[] }[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState(-1);
  const backdropRef = useRef<HTMLDivElement>(null);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [acts, users] = await Promise.all([
        obtenerActividadesDePunto(tarea.id),
        obtenerUsuariosAsignables(),
      ]);
      setActividades(acts);
      setUsuarios(users);
    } catch (e) {
      console.error('Error cargando actividades:', e);
      toast.error('No se pudieron cargar las actividades.');
    } finally {
      setCargando(false);
    }
  };

  const handleCompletarActividad = async (id: string) => {
    try {
      setCargandoAccion(id);
      const { cambiarEstado } = await import('@/components/tareas/actions');
      await cambiarEstado(id, 'Completado');
      toast.success('Actividad completada');
      setHasChanged(true);
      await cargarDatos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al completar');
    } finally {
      setCargandoAccion(null);
    }
  };

  const handleMarcarRevisado = async (id: string) => {
    try {
      setCargandoAccion(id);
      const { marcarRevisadoPorConcejo } = await import('@/components/tareas/actions');
      await marcarRevisadoPorConcejo(id);
      toast.success('Marcada como revisada');
      setHasChanged(true);
      await cargarDatos();
    } catch (error) {
      toast.error('Error al marcar revisado');
    } finally {
      setCargandoAccion(null);
    }
  };

  const handleToggleChecklist = async (taskId: string, newChecklist: any[]) => {
    try {
      const { updateChecklist } = await import('@/components/tareas/actions');
      // Actualizamos optimísticamente el estado local
      setActividades((prev) => 
        prev.map(act => act.id === taskId ? { ...act, checklist: newChecklist } : act)
      );
      await updateChecklist(taskId, newChecklist);
      setHasChanged(true);
      await cargarDatos();
    } catch (error) {
      toast.error('Error al actualizar el checklist');
      // Revertir en caso de error
      await cargarDatos();
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarDatos();
      setVista('lista');
      setPdfViendo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tarea.id]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const usuariosFiltrados = useMemo(
    () => usuarios.filter((u) => u.nombre.toLowerCase().includes(searchTerm.toLowerCase())),
    [usuarios, searchTerm],
  );

  const usuariosParaMencion = useMemo(() => {
    return usuarios.filter(
      (u) =>
        (u.activo === undefined || u.activo) &&
        u.nombre.toLowerCase().includes(mentionSearchTerm.toLowerCase()) &&
        u.user_id !== assignedTo &&
        !miembros.some((m) => m.userId === u.user_id),
    );
  }, [usuarios, mentionSearchTerm, assignedTo, miembros]);

  const limpiarFormulario = () => {
    setEditandoId(null);
    setTitle('');
    setDescription('');
    setDescripcionAnterior('');
    setDueDate(fechaPorDefecto());
    setAssignedTo('');
    setSearchTerm('');
    setShowDropdown(false);
    setChecklistInput('');
    setChecklist([]);
    setMiembros([]);
    setShowMentionDropdown(false);
    setMentionPosition(-1);
    setMentionSearchTerm('');
  };

  const abrirNueva = () => {
    limpiarFormulario();
    setVista('formulario');
  };

  const abrirEdicion = (actividad: ActividadConcejo) => {
    setEditandoId(actividad.id);
    setTitle(actividad.title);
    setDescription('');
    setDescripcionAnterior(actividad.description || '');
    setDueDate(formatearFechaInput(actividad.due_date));
    setAssignedTo(actividad.assigned_to || '');
    setSearchTerm(actividad.assignee_nombre || '');
    setShowDropdown(false);
    setChecklistInput('');
    setChecklist([]);
    setMiembros([]);
    setShowMentionDropdown(false);
    setMentionPosition(-1);
    setMentionSearchTerm('');
    setVista('formulario');
  };

  const seleccionarUsuario = (userId: string, nombre: string) => {
    setAssignedTo(userId);
    setSearchTerm(nombre);
    setShowDropdown(false);
    // Si el encargado cambia y era miembro, quitarlo de la lista
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

    // Buscar si estamos escribiendo una mención (ej: "@Juan Perez")
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^@\n]*)$/);
    if (mentionMatch && mentionMatch[1].length >= 3) {
      setShowMentionDropdown(true);
      setMentionSearchTerm(mentionMatch[1]);
      setMentionPosition(cursor - mentionMatch[1].length);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (user: UsuarioAsignable) => {
    const val = description;
    const cursor = mentionPosition;
    const beforeAt = val.slice(0, cursor - 1); // everything before '@'
    const textAfterCursor = val.slice(cursor + mentionSearchTerm.length);

    const newDescription = `${beforeAt}@${user.nombre} ${textAfterCursor}`;
    setDescription(newDescription);
    setShowMentionDropdown(false);

    if (!miembros.some((m) => m.userId === user.user_id) && user.user_id !== assignedTo) {
      setMiembros((prev) => [...prev, { userId: user.user_id, nombre: user.nombre, asignaciones: [] }]);
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

  const sendPushNotification = async (titulo: string, mensaje: string, userIds: string[]) => {
    try {
      if (userIds.length === 0) return;
      await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titulo,
          message: mensaje,
          url: '/protected/actividades',
          targetIds: userIds,
        }),
      });
    } catch (e) {
      console.error('Error enviando push de actividad:', e);
    }
  };

  const guardar = async () => {
    if (!title.trim() || !dueDate) {
      toast.warn('Completa el título y la fecha de la actividad.');
      return;
    }
    if (!assignedTo) {
      toast.warn('Selecciona a quién se le asigna la actividad.');
      return;
    }

    setGuardando(true);
    try {
      const dueIso = new Date(dueDate).toISOString();
      const nombreAsignado = usuarios.find((u) => u.user_id === assignedTo)?.nombre || 'el usuario';
      const esGrupal = miembros.length > 0;

      if (editandoId) {
        const actual = actividades.find((a) => a.id === editandoId);
        const cambios: string[] = [];
        if (actual) {
          if (formatearFechaInput(actual.due_date) !== dueDate) {
            if (new Date(dueDate) < new Date()) {
              toast.warn('La fecha límite no puede quedar en el pasado.');
              setGuardando(false);
              return;
            }
            cambios.push(
              `Fecha límite: ${formatearFechaBitacora(actual.due_date)} → ${formatearFechaBitacora(dueIso)}`,
            );
          }
        }

        await editarActividadConcejo(editandoId, {
          title: title.trim(),
          description: componerBitacoraActividad({
            nota: description,
            anterior: descripcionAnterior,
            cambios,
          }),
          due_date: dueIso,
          assigned_to: actual?.assigned_to || assignedTo,
          nuevosMiembros: esGrupal ? miembros.map((m) => ({ userId: m.userId, asignaciones: m.asignaciones })) : undefined,
        });

        if (actual?.assigned_to) {
          sendPushNotification(
            '📋 Actividad actualizada',
            `Se actualizó la actividad del Concejo: "${title.trim()}".`,
            [actual.assigned_to],
          );
        }

        if (esGrupal) {
          sendPushNotification(
            '👥 Nueva Actividad Grupal',
            `Se te ha asignado como participante en la actividad del Concejo: "${title.trim()}"`,
            miembros.map((m) => m.userId),
          );
        }

        toast.success(`Actividad actualizada. Se notificó a ${nombreAsignado}.`);
      } else {
        await crearActividadConcejo({
          tareaConcejoId: tarea.id,
          title: title.trim(),
          description,
          due_date: dueIso,
          assigned_to: assignedTo,
          checklist,
          miembros: esGrupal ? miembros.map((m) => ({ userId: m.userId, asignaciones: m.asignaciones })) : undefined,
        });

        sendPushNotification(
          '📋 Nueva Actividad Asignada',
          `Se te asignó una actividad del Concejo: "${title.trim()}".`,
          [assignedTo],
        );

        if (esGrupal) {
          sendPushNotification(
            '👥 Nueva Actividad Grupal',
            `Se te ha asignado como participante en la actividad del Concejo: "${title.trim()}"`,
            miembros.map((m) => m.userId),
          );
        }

        toast.success(`Actividad asignada a ${nombreAsignado}.`);
      }

      setHasChanged(true);
      await cargarDatos();
      limpiarFormulario();
      setVista('lista');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error al guardar la actividad.';
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (actividad: ActividadConcejo) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar actividad?',
      text: `Se eliminará "${actividad.title}". Esta acción no se puede revertir.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) return;

    try {
      await eliminarActividadConcejo(actividad.id);
      setHasChanged(true);
      await cargarDatos();
      toast.success('Actividad eliminada.');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error al eliminar la actividad.';
      toast.error(mensaje);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={() => onClose(hasChanged)} className="relative z-[200]">
        <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-zinc-100 dark:bg-zinc-900" />
        </TransitionChild>
        <div className="fixed inset-0 flex flex-col">
          <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-2" enterTo="opacity-100 translate-y-0" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-2">
            <DialogPanel className="flex h-[100dvh] w-full flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-800">

              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] dark:border-zinc-700 sm:px-6">
                <div className="min-w-0 pr-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-[#0066cc] dark:text-blue-400">
                    Actividades asignadas
                  </DialogTitle>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground line-clamp-2">
                    {tarea.titulo_item}
                  </p>
                </div>
                <button
                  onClick={() => onClose(hasChanged)}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-white"
                  aria-label="Cerrar"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar sm:px-6">
                {cargando ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : vista === 'lista' ? (
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                    {puedeEditar && (
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
                              onVerPdf={setPdfViendo}
                              onCompletar={puedeEditar ? handleCompletarActividad : undefined}
                              onMarcarRevisado={puedeEditar ? handleMarcarRevisado : undefined}
                              onToggleChecklist={puedeEditar ? handleToggleChecklist : undefined}
                              cargandoAccion={cargandoAccion}
                              acciones={
                                puedeEditar ? (
                                  <>
                                    <button
                                      onClick={() => abrirEdicion(actividad)}
                                      className="cursor-pointer rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#0066cc] dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                                      title="Editar"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => eliminar(actividad)}
                                      className="cursor-pointer rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                ) : undefined
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-3xl space-y-4">
                    <button
                      onClick={() => { limpiarFormulario(); setVista('lista'); }}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <ArrowLeft size={16} /> Volver a la lista
                    </button>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Título de la actividad</label>
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
                            const original = actual ? formatearFechaInput(actual.due_date) : '';
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
                            onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); if (!e.target.value.trim()) setAssignedTo(''); }}
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
                                    key={u.user_id}
                                    type="button"
                                    onClick={() => seleccionarUsuario(u.user_id, u.nombre)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 text-sm transition-colors border-b border-gray-50 dark:border-neutral-700/50 last:border-0"
                                  >
                                    {u.nombre}
                                  </button>
                                ))
                              ) : (
                                <div className="p-3 text-center text-gray-400 text-xs italic">No se encontraron usuarios</div>
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
                          placeholder={editandoId ? 'Escribe una nueva nota para la bitácora... (Usa @ para mencionar usuarios)' : 'Detalles de la actividad... (Usa @ para mencionar usuarios)'}
                          rows={4}
                          className={`w-full p-3 sm:p-4 bg-transparent border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words placeholder-gray-400 dark:placeholder-gray-500 resize-none relative z-10 custom-scrollbar ${description ? 'text-transparent' : 'text-gray-700 dark:text-gray-100'}`}
                          style={{ caretColor: '#3b82f6', letterSpacing: 'normal', wordSpacing: 'normal' }}
                        />
                        {showMentionDropdown && usuariosParaMencion.length > 0 && (
                          <div className="absolute z-50 w-full bottom-full mb-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto ring-1 ring-black/5 dark:ring-white/10">
                            {usuariosParaMencion.map((u) => (
                              <button
                                key={u.user_id}
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
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarChecklist(); } }}
                            className="flex-1 p-3 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100"
                          />
                          <button type="button" onClick={agregarChecklist} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors shrink-0">
                            <Plus size={20} />
                          </button>
                        </div>
                        {checklist.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {checklist.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 p-2.5 rounded-lg border border-gray-100 dark:border-neutral-700">
                                <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">• {item.title}</span>
                                <button type="button" onClick={() => quitarChecklist(idx)} className="text-red-400 hover:text-red-600 p-1">
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
                      disabled={guardando}
                      className="h-12 w-full cursor-pointer rounded-xl bg-zinc-200 text-sm font-semibold text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                    >
                      {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Asignar actividad'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-700 sm:px-6">
                <p className="text-center text-xs text-muted-foreground">
                  {actividades.length} actividad{actividades.length === 1 ? '' : 'es'} en este punto
                </p>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
        <VerPDF
          isOpen={!!pdfViendo?.ruta_storage}
          onClose={() => setPdfViendo(null)}
          filePath={pdfViendo?.ruta_storage || ''}
          fileName={pdfViendo?.nombre || ''}
          bucketName="archivos_actividades"
        />
      </Dialog>
    </Transition>
  );
}
