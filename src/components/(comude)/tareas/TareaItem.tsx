'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tarea, ChecklistItem, Usuario, ActMiembro } from './lib/zod';
import EditarTarea from './modals/EditarTarea';
import DuplicateTarea from './modals/DuplicateTarea'; 
import TareaChecklist from './TareaChecklist'; 
import MiembroChecklist from './MiembroChecklist';
import GestorArchivos from './GestorArchivos';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { 
  Edit2, Trash2, ChevronDown, MoreVertical, MoreHorizontal, Calendar, 
  User, Clock, AlertCircle, Copy, ArrowRight, FileText, Users, CheckCircle2,
  Crown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTareaMutations } from './lib/hooks'; 

interface Props {
  tarea: Tarea;
  isExpanded?: boolean;
  onToggle?: () => void;
  isJefe: boolean;
  isRRHH?: boolean;
  usuarioActual: string;
  nombreUsuarioActual: string;
  usuarios: Usuario[]; 
}

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

const renderNombreTab = (label: string) => {
  if (!label) return null;
  const palabras = label.trim().split(/\s+/);
  const esMultilinea = palabras.length >= 4;

  if (esMultilinea) {
    const mid = Math.ceil(palabras.length / 2);
    const linea1 = palabras.slice(0, mid).join(" ");
    const linea2 = palabras.slice(mid).join(" ");
    return (
      <span className="flex flex-col items-center leading-[1.1] text-[9.5px] sm:text-[10.5px] md:text-xs text-center max-w-[125px] sm:max-w-[160px]">
        <span className="truncate max-w-full">{linea1}</span>
        <span className="truncate max-w-full">{linea2}</span>
      </span>
    );
  }

  return (
    <span className="text-[11px] sm:text-xs md:text-sm leading-tight text-center">
      {label}
    </span>
  );
};

const renderConfirmacion = (isoString?: string | null) => {
  if (!isoString) {
    return <span className="text-[10px] text-orange-500 font-medium ml-1">Pendiente</span>;
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
  return <span className="text-[10px] text-green-500 font-medium ml-1 whitespace-nowrap">Confirmación: {diaSemana} {day}/{month}/{year}, {hora}:{minutos} {period}</span>;
};

export default function TareaItem({ tarea, isExpanded = false, onToggle, isJefe, isRRHH, usuarioActual, nombreUsuarioActual, usuarios }: Props) { 
  const { cambiarStatus, eliminar, marcarRevisado } = useTareaMutations(); 

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  // Tab activo en la vista grupal: si soy miembro, mi tab por defecto, sino el del encargado
  const [tabActivo, setTabActivo] = useState<string>(() => {
    const miMiembro = tarea.miembros?.find(m => m.id_user === usuarioActual);
    return miMiembro ? miMiembro.id : 'encargado';
  });

  // ── Helpers de formato ────────────────────────────────────────────────────
  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    return new Date(fechaISO).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatearConfirmadoAt = (fechaISO: string) => {
    const d = new Date(fechaISO);
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
    return `${diaSemana} ${day}/${month}/${year}, ${hora}:${minutos} ${period}`;
  };

  const renderDescripcionConLinks = (texto: string) => {
    if (!texto) return null;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(\/[^\s]*)?)/g;
    const partes = texto.split(urlRegex);
    return partes.map((parte, i) => {
      if (!parte) return null;
      if (parte.match(urlRegex)) {
        const href = parte.startsWith('http') ? parte : parte.startsWith('www.') ? `https://${parte}` : `https://${parte}`;
        return ( <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:no-underline break-all" onClick={(e) => e.stopPropagation()}>{parte}</a> );
      }
      return <span key={i}>{parte}</span>;
    });
  };

  const formatearSesion = (fechaISO: string) => {
    if (!fechaISO) return '';
    const d = new Date(fechaISO);
    const diaSemana = d
      .toLocaleDateString('es-GT', { weekday: 'short' })
      .replace('.', '')
      .toLowerCase();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    let hora = d.getHours();
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const period = hora >= 12 ? 'PM' : 'AM';
    hora = hora % 12;
    hora = hora ? hora : 12;
    const horaStr = String(hora).padStart(2, '0');
    return `${diaSemana} ${day}/${month}/${year} a las ${horaStr}:${minutos} ${period}`;
  };

  // ── Lógica grupal ─────────────────────────────────────────────────────────
  const miembros: ActMiembro[] = tarea.miembros || [];
  const esGrupal = miembros.length > 0;
  const esEncargado = tarea.assigned_to === usuarioActual;
  const miMiembro = miembros.find(m => m.id_user === usuarioActual);
  const soySoloMiembro = !esEncargado && !!miMiembro;

  // ── Cálculo de progreso ────────────────────────────────────────────────────
  const checklist = (tarea.checklist as unknown as ChecklistItem[]) || [];
  const completadosEncargado = checklist.filter(c => c.is_completed).length;
  const totalEncargado = checklist.length;

  let porcentaje: number = 0;
  if (esGrupal) {
    // Para los miembros SÍ sumamos +1 que representa el botón final de "Completar parte"
    const totalMiembros = miembros.reduce((s, m) => s + (m.asignaciones?.length || 0) + 1, 0);
    const completadosMiembros = miembros.reduce((s, m) => s + (m.asignaciones?.filter(a => a.is_complete).length || 0) + (m.completed_at ? 1 : 0), 0);
    const totalGlobal = totalEncargado + totalMiembros;
    const completosGlobal = completadosEncargado + completadosMiembros;
    porcentaje = totalGlobal === 0 ? 0 : Math.round((completosGlobal / totalGlobal) * 100);
  } else {
    porcentaje = totalEncargado === 0 ? 0 : Math.round((completadosEncargado / totalEncargado) * 100);
  }

  const fechaLimite = new Date(tarea.due_date);
  const esVencida = new Date() > fechaLimite && tarea.status !== 'Completado';
  const isReadOnly = tarea.status === 'Completado' || !!isRRHH;
  const esAutoAsignado = tarea.created_by === tarea.assigned_to;
  const esAsignadoAMi = tarea.assigned_to === usuarioActual;
  const esCreadoPorMi = tarea.created_by === usuarioActual;
  const nombreCreador = getNombreCorto(tarea.creator?.nombre || 'Desconocido');
  const nombreAsignado = getNombreCorto(tarea.assignee?.nombre || 'Sin asignar');
  const puedeEditar = isJefe || (!isReadOnly && (esAsignadoAMi || esCreadoPorMi));
  const esSinConfirmar = tarea.status !== 'Completado' && !tarea.confirmed_at;

  // Color de la barra de progreso
  const getColorBarra = (pct: number) => {
    if (pct === 100) return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]';
    if (pct > 75) return 'bg-yellow-300';
    if (pct > 50) return 'bg-yellow-500';
    if (pct > 25) return 'bg-orange-500';
    if (pct > 0) return 'bg-red-600';
    return 'bg-slate-200 dark:bg-neutral-600';
  };
  const colorBarra = getColorBarra(porcentaje);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleTerminar = async () => {
    // Verificación en cliente (la real es en el SA)
    if (checklist.some(i => !i.is_completed)) {
      Swal.fire({ icon: 'warning', title: 'Falta poco...', text: 'Completa tus actividades asignadas primero.', confirmButtonColor: '#4f46e5' });
      return;
    }
    // Si es grupal, verificar que los miembros hayan completado
    if (esGrupal && miembros.some(m => !m.completed_at)) {
      Swal.fire({ icon: 'warning', title: 'Falta poco...', text: 'Todos los participantes deben completar sus actividades primero.', confirmButtonColor: '#4f46e5' });
      return;
    }

    try {
      await cambiarStatus.mutateAsync({ id: tarea.id, estado: 'Completado' });
      Swal.fire({ icon: 'success', title: '¡Completada!', timer: 1500, showConfirmButton: false });
      if (isExpanded && onToggle) { onToggle(); }
    } catch (error: any) { 
      Swal.fire({ 
        icon: 'warning', 
        title: 'Acción no permitida', 
        text: error.message || 'No se puede completar la actividad.', 
        confirmButtonColor: '#4f46e5' 
      });
    }
  };

  const handleEliminar = async (e?: React.MouseEvent) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const result = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' });
    if (result.isConfirmed) {
        try { 
            await eliminar.mutateAsync(tarea.id); 
            toast.info('Actividad eliminada'); 
        } 
        catch { toast.error('Error al eliminar'); }
    }
  };

  const handleMarcarRevisado = async () => {
    try {
      await marcarRevisado.mutateAsync(tarea.id);
      toast.success('Actividad marcada como revisada');
    } catch {
      toast.error('Error al marcar como revisada');
    }
  };

  const loading = cambiarStatus.isPending || eliminar.isPending || marcarRevisado.isPending;

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

  const retrasoText = formatRetraso(tarea.due_date, tarea.updated_at);

  // ── Estilos de estado ──────────────────────────────────────────────────────
  const getStatusStyles = () => {
      if (tarea.status === 'Completado') {
          return { badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', border: 'border-l-green-500 dark:border-l-green-500', label: 'Completado' };
      }
      if (esVencida) {
          return { badge: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', border: 'border-l-orange-500 dark:border-l-orange-500', label: 'Vencido' };
      }
      if (esSinConfirmar) {
          return { badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', border: 'border-l-red-500 dark:border-l-red-500', label: (tarea.status === 'En Proceso' || !tarea.status) ? 'Asignado' : tarea.status };
      }
      if (esGrupal) {
          return { badge: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800', border: 'border-l-purple-500 dark:border-l-purple-500', label: (tarea.status === 'En Proceso' || !tarea.status) ? 'Grupal' : tarea.status };
      }
      return { badge: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800', border: 'border-l-purple-500 dark:border-l-purple-500', label: (tarea.status === 'En Proceso' || !tarea.status) ? 'Asignado' : tarea.status };
  };
  const { badge, border, label } = getStatusStyles();

  // ── Texto de concejo ───────────────────────────────────────────────────────
  const textoAsignacionConcejo = (
    <div className="flex flex-col gap-1 text-xs w-full">
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="bg-slate-100 dark:bg-neutral-800 p-1 rounded-full shrink-0">
            <User size={10} className="text-blue-500" />
          </div>
          <span className="text-slate-600 dark:text-gray-300 truncate">
            <span className="sm:hidden">Act. asignada por el </span>
            <span className="hidden sm:inline">Actividad asignada por el </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">COMUDE</span>
          </span>
        </div>
        <div className="shrink-0 text-right">
          {tarea.confirmed_at ? (
            <p className="text-[11px] sm:text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
              <span className="sm:hidden">Conf. </span>
              <span className="hidden sm:inline">Confirmación: </span>
              {formatearConfirmadoAt(tarea.confirmed_at)}
            </p>
          ) : tarea.status !== 'Completado' ? (
            <p className="text-[11px] sm:text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
              Sin confirmar
            </p>
          ) : null}
        </div>
      </div>
      {tarea.agenda_titulo && (
        <div className="flex items-start gap-1.5 text-slate-500 dark:text-gray-400 pl-1">
          <Calendar size={11} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="min-w-0 leading-snug">
            <span className="font-medium text-slate-600 dark:text-gray-300">
              {tarea.agenda_titulo}
            </span>
            {tarea.agenda_fecha && (
              <span className="inline-block whitespace-nowrap text-slate-400 dark:text-gray-400 text-[11px] sm:text-xs">
                <span className="mx-1.5 text-slate-300 dark:text-gray-600 font-light">|</span>
                {formatearSesion(tarea.agenda_fecha)}
              </span>
            )}
          </p>
        </div>
      )}
      {tarea.punto_titulo && (
        <div className="flex items-start gap-1.5 text-slate-500 dark:text-gray-400 pl-1">
          <FileText size={11} className="text-slate-400 shrink-0 mt-0.5" />
          <span className="break-words min-w-0">
            <span className="text-slate-400">Punto: </span>
            <span className="font-medium text-slate-600 dark:text-gray-300">{tarea.punto_titulo}</span>
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
    <div className={`
        bg-white dark:bg-neutral-900 
        rounded-2xl 
        shadow-xs hover:shadow-md
        transition-all duration-300 
        border-l-[6px] ${border} 
        border-t border-r border-b border-slate-200/80 dark:border-neutral-800 
        overflow-hidden 
        ${isExpanded ? 'ring-2 ring-blue-500/30 dark:ring-blue-800/40 shadow-xl z-10' : 'hover:-translate-y-0.5'}
    `}>
      {/* ── Cabecera (click para expandir) ─────────────────────────────── */}
      <div onClick={onToggle} className="px-1.5 pt-3 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3 cursor-pointer flex flex-col gap-2 sm:gap-2.5">
        <div className="flex justify-between items-start gap-3 sm:gap-4 w-full">
            <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider border ${badge}`}>
                        {esVencida && <AlertCircle size={12} strokeWidth={3} />}
                        {esGrupal && !esVencida && tarea.status !== 'Completado' && <Users size={10} strokeWidth={3} />}
                        {label}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-gray-400">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatearSesion(tarea.due_date)}</span>
                    </span>
                </div>
                <h3 className="font-bold text-base text-slate-800 dark:text-gray-100 leading-snug break-words">
                    {tarea.title}
                </h3>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                {(isJefe || puedeEditar) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                title="Acciones"
                            >
                                <MoreVertical size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-44 rounded-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {isJefe && (
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setIsDuplicateModalOpen(true); }}
                                    className="cursor-pointer font-medium"
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicar
                                </DropdownMenuItem>
                            )}
                            {puedeEditar && (
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }}
                                    className="cursor-pointer font-medium"
                                >
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {isJefe && (
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); void handleEliminar(); }}
                                    className="cursor-pointer font-medium text-red-600 dark:text-red-400"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <div className={`p-2 text-slate-400 dark:text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`}>
                    <ChevronDown size={20} />
                </div>
            </div>
        </div>

        {/* Mini-preview colapsado */}
        {!isExpanded && (
            <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-gray-400 font-medium w-full border-t pt-2 sm:pt-2.5 border-slate-100 dark:border-neutral-800">
                {porcentaje > 0 && (
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold shrink-0 ${porcentaje === 100 ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-gray-400'}`}>{porcentaje}%</span>
                        <div className="w-24 sm:w-32 md:w-52 bg-slate-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden flex-shrink-0">
                            <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorBarra}`} style={{ width: `${porcentaje}%` }} />
                        </div>
                        {esGrupal && <span className="text-[9px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider">Grupal</span>}
                    </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 w-full">
                    <div className="min-w-0 flex-1 w-full">
                        {tarea.es_concejo ? textoAsignacionConcejo : esAutoAsignado ? (
                            <div className="flex items-center gap-1.5 text-xs flex-wrap">
                                 <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Creado y asignado por:</span>
                                 <span className={`truncate max-w-[200px] ${esAsignadoAMi ? 'text-blue-600 font-bold' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                                    {esAsignadoAMi ? `${nombreAsignado} (Yo)` : nombreAsignado}
                                 </span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-xs w-full">
                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-gray-300 w-full sm:w-auto">
                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider shrink-0">Creado por: </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block w-full sm:w-auto">{nombreCreador}</span>
                                </div>
                                <ArrowRight size={12} className="hidden sm:block text-slate-300 dark:text-gray-600 shrink-0" />
                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-gray-300 w-full sm:w-auto">
                                    <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider shrink-0">Encargado: </span>
                                    <span className={`font-bold truncate block w-full sm:w-auto ${esAsignadoAMi ? 'text-blue-600' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {esAsignadoAMi ? `${nombreAsignado} (Yo)` : nombreAsignado}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    {!tarea.es_concejo && (
                      <div className="shrink-0 text-left sm:text-right pl-1 sm:pl-0 pt-0.5 sm:pt-0">
                        {tarea.confirmed_at ? (
                          <p className="text-[11px] sm:text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                            <span className="sm:hidden">Conf. </span>
                            <span className="hidden sm:inline">Confirmación: </span>
                            {formatearConfirmadoAt(tarea.confirmed_at)}
                          </p>
                        ) : tarea.status !== 'Completado' ? (
                          <p className="text-[11px] sm:text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                            Sin confirmar
                          </p>
                        ) : null}
                      </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* ── Contenido expandido ─────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
        <div className="px-2 sm:px-5 pb-5 pt-0 border-t border-slate-100 dark:border-neutral-800 mt-1">
            <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-8 gap-6 mt-5">
                
                {/* ── Columna izquierda ─────────────────────────────────── */}
                <div className="flex flex-col gap-5 lg:col-span-2">
                    {/* Descripción */}
                    <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-xl border border-slate-100 dark:border-neutral-700 h-fit">
                        <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 mb-2 block">Descripción</label>
                        <div className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line leading-relaxed break-words">
                            {tarea.description ? renderDescripcionConLinks(tarea.description) : <span className="italic text-slate-400 dark:text-gray-500 flex items-center gap-2"><MoreHorizontal size={16}/> Sin descripción...</span>}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Fecha */}
                        <div className="flex flex-col gap-2">
                          <div className={`inline-flex items-center flex-wrap gap-2 px-3 py-2 rounded-lg text-xs font-medium border w-full sm:w-auto ${esVencida ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'}`}>
                              <Calendar size={14} />
                              <span>Vence: {new Date(tarea.due_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                              <span className="border-l pl-2 ml-1 border-current opacity-50"><Clock size={14} className="inline mr-1"/>{new Date(tarea.due_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {retrasoText && (
                            <span className="text-xs font-semibold text-red-500 dark:text-red-400 ml-1">
                                {tarea.status === 'Completado' ? `⚠️ Se completó con un tiempo tardío de: ${retrasoText.replace(/^Atrasada por /i, '')}` : `⚠️ ${retrasoText}`}
                            </span>
                          )}
                        </div>

                        {/* Barras de progreso */}
                        {(totalEncargado > 0 || esGrupal) && (
                            <div className="bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-slate-100 dark:border-neutral-800">
                                  <>
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wide">
                                          {esGrupal ? 'Progreso Global' : 'Progreso Total'}
                                        </span>
                                        <span className={`text-xs font-bold ${porcentaje === 100 ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-gray-300'}`}>{porcentaje}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-neutral-700 h-2.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorBarra}`} style={{ width: `${porcentaje}%` }}></div>
                                    </div>

                                    {/* Sub-barras individuales para actividades grupales (solo Encargado) */}
                                    {esGrupal && (esEncargado || soySoloMiembro || isJefe) && (
                                      <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-neutral-700 pt-3">
                                        {/* Barra del encargado */}
                                        {totalEncargado > 0 && (
                                          <div>
                                            <div className="flex justify-between items-start sm:items-center mb-1 gap-2">
                                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 text-[10px] text-slate-500 dark:text-gray-400 font-medium min-w-0 flex-1">
                                                <div className="flex items-center gap-1 min-w-0">
                                                  <span className="truncate">{esAsignadoAMi ? `${getNombreCorto(nombreUsuarioActual)} (Yo)` : getNombreCorto(tarea.assignee?.nombre || 'Encargado')}</span>
                                                  <span className="text-blue-500 dark:text-blue-400 shrink-0">(Encargado)</span>
                                                </div>
                                                <div className="sm:ml-1 shrink-0">
                                                  {renderConfirmacion(tarea.confirmed_at)}
                                                </div>
                                              </div>
                                              <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 shrink-0 mt-0.5 sm:mt-0">
                                                {totalEncargado === 0 ? '—' : `${completadosEncargado}/${totalEncargado}`}
                                              </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all duration-500 ${getColorBarra(totalEncargado === 0 ? 0 : Math.round((completadosEncargado / totalEncargado) * 100))}`}
                                                style={{ width: `${totalEncargado === 0 ? 0 : Math.round((completadosEncargado / totalEncargado) * 100)}%` }}
                                              />
                                            </div>
                                          </div>
                                        )}

                                         {/* Barras de miembros */}
                                        {miembros.map(m => {
                                            const total = (m.asignaciones?.length || 0) + 1;
                                            const comp = (m.asignaciones?.filter(a => a.is_complete).length || 0) + (m.completed_at ? 1 : 0);
                                            const pct = Math.round((comp / total) * 100);
                                            return (
                                              <div key={m.id}>
                                                <div className="flex justify-between items-start sm:items-center mb-1 gap-2">
                                                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 text-[10px] text-slate-500 dark:text-gray-400 font-medium min-w-0 flex-1">
                                                    <span className="truncate">{getNombreCorto(m.nombre_usuario)}</span>
                                                    <div className="sm:ml-1 shrink-0">
                                                      {renderConfirmacion(m.confirmed_at)}
                                                    </div>
                                                  </div>
                                                  <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 shrink-0 mt-0.5 sm:mt-0">{comp}/{total}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                                                  <div
                                                    className={`h-full rounded-full transition-all duration-500 ${getColorBarra(pct)}`}
                                                    style={{ width: `${pct}%` }}
                                                  />
                                                </div>
                                              </div>
                                            );
                                        })}
                                      </div>
                                    )}
                                  </>
                            </div>
                        )}
                    </div>
                    
                    {/* Botón completar (solo encargado o tarea individual) */}
                    {tarea.status !== 'Completado' && (
                        <div className="mt-auto pt-2">
                            {esEncargado && !isRRHH ? (
                                <button
                                  onClick={handleTerminar}
                                  disabled={loading}
                                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 transform active:scale-[0.98] text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer`}
                                >
                                {loading && cambiarStatus.isPending ? <Clock size={18} className="animate-spin" /> : 'Finalizar Actividad'}
                                </button>
                            ) : (
                                <div
                                  className="w-full py-3 rounded-xl font-semibold text-sm flex justify-center items-center gap-2 border-2 border-dashed border-slate-300 dark:border-neutral-700 bg-slate-50/70 dark:bg-neutral-800/50 text-slate-400 dark:text-neutral-500 select-none cursor-not-allowed"
                                  title="Pendiente de finalizar por la persona asignada"
                                >
                                  <Clock size={16} className="opacity-60" />
                                  <span>Pendiente</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botón marcar como revisado */}
                    {tarea.status === 'Completado' && !tarea.revisado_por && (
                        <div className="mt-auto pt-2">
                            <button
                                onClick={handleMarcarRevisado}
                                disabled={loading}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 transform active:scale-[0.98] text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 dark:shadow-none"
                            >
                                {loading && marcarRevisado.isPending ? <Clock size={18} className="animate-spin" /> : 'Marcar como Revisado'}
                            </button>
                        </div>
                    )}

                    {/* Mostrar quién revisó */}
                    {tarea.status === 'Completado' && tarea.revisado_por && (
                        <div className="mt-auto pt-2">
                            <div className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center text-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <CheckCircle2 size={14} />
                                    <span>Revisado por {tarea.revisado_por.nombre}</span>
                                </div>
                                <span className="font-medium opacity-80 text-[10px]">{formatearSesion(tarea.revisado_por.fecha)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Columna derecha: Checklist / Tabs grupales ────────── */}
                <div className="flex flex-col h-full lg:col-span-3">
                  <div className="bg-slate-50/50 dark:bg-neutral-800/30 rounded-xl border border-slate-100 dark:border-neutral-800 p-4 h-full min-h-[300px]">

                    {/* ACTIVIDAD INDIVIDUAL → TareaChecklist normal */}
                    {!esGrupal && (
                      <TareaChecklist 
                        tareaId={tarea.id} 
                        checklist={checklist} 
                        isReadOnly={isReadOnly} 
                      />
                    )}

                    {/* ACTIVIDAD GRUPAL → Vista del Encargado y Miembros con Tabs */}
                    {esGrupal && (esEncargado || soySoloMiembro || isJefe) && (
                      <div className="flex flex-col h-full">
                        {/* Tabs */}
                        <div className="flex justify-start sm:justify-center gap-2.5 sm:gap-4 md:gap-6 mb-4 sm:mb-6 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-neutral-700 px-2 scrollbar-none">
                          {(() => {
                            const tabs = [
                              {
                                id: 'encargado',
                                label: esAsignadoAMi ? 'Mi Parte' : nombreAsignado,
                                isMiParte: esAsignadoAMi,
                                completedAt: false,
                                rol: 'Encargado'
                              },
                              ...miembros.map(m => ({
                                id: m.id,
                                label: m.id_user === usuarioActual ? 'Mi Parte' : getNombreCorto(m.nombre_usuario),
                                isMiParte: m.id_user === usuarioActual,
                                completedAt: m.completed_at,
                                rol: 'Miembro'
                              }))
                            ];

                            // Ordenar: 'Mi Parte' siempre de primero. Si no hay 'Mi Parte', 'encargado' de primero.
                            tabs.sort((a, b) => {
                              if (a.isMiParte) return -1;
                              if (b.isMiParte) return 1;
                              if (a.id === 'encargado') return -1;
                              if (b.id === 'encargado') return 1;
                              return 0;
                            });

                            return tabs.map(t => {
                              const isActive = tabActivo === t.id;
                              const isEncargadoTab = t.id === 'encargado';
                              const activeColorClass = isEncargadoTab
                                ? 'text-blue-600 dark:text-blue-400 after:bg-blue-600 dark:after:bg-blue-400'
                                : 'text-purple-600 dark:text-purple-400 after:bg-purple-600 dark:after:bg-purple-400';

                              return (
                                <button
                                  key={t.id}
                                  onClick={() => setTabActivo(t.id)}
                                  className={`relative pb-2.5 sm:pb-3 px-1.5 sm:px-2.5 flex flex-col items-center transition-colors shrink-0 ${
                                    isActive
                                      ? `${activeColorClass} after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px]`
                                      : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-300'
                                  }`}
                                >
                                  <span className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider mb-0.5 ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                                    {t.rol}
                                  </span>
                                  <div className="flex items-center gap-1 sm:gap-1.5 leading-tight">
                                    {isEncargadoTab ? (
                                      <Crown size={13} className={`shrink-0 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'opacity-40'}`} strokeWidth={2.5} />
                                    ) : (
                                      <User size={13} className={`shrink-0 ${isActive ? 'text-purple-500 dark:text-purple-400' : 'opacity-40'}`} strokeWidth={2.5} />
                                    )}
                                    <div className="flex items-center gap-1">
                                      {renderNombreTab(t.label)}
                                      {t.completedAt && <CheckCircle2 size={12} className="text-green-500 shrink-0" strokeWidth={3} />}
                                    </div>
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>

                        {/* Contenido del tab activo */}
                        {tabActivo === 'encargado' && (
                          <TareaChecklist 
                            tareaId={tarea.id} 
                            checklist={checklist} 
                            isReadOnly={isReadOnly || soySoloMiembro} 
                          />
                        )}
                        {tabActivo !== 'encargado' && (() => {
                          const miembro = miembros.find(m => m.id === tabActivo);
                          if (!miembro) return null;
                          return (
                            <MiembroChecklist
                              miembroId={miembro.id}
                              asignaciones={miembro.asignaciones || []}
                              isReadOnly={isReadOnly || (soySoloMiembro && miMiembro?.id !== miembro.id)}
                              comentario={miembro.comentario}
                              completedAt={miembro.completed_at}
                            />
                          );
                        })()}
                      </div>
                    )}

                    {/* ACTIVIDAD GRUPAL → Usuario sin rol definido (solo ve descripción) */}
                    {esGrupal && !esEncargado && !soySoloMiembro && !isJefe && (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 dark:text-gray-500 py-8">
                        <Users size={28} strokeWidth={1.5} />
                        <p className="text-sm text-center">Solo los participantes asignados pueden ver las sub-actividades.</p>
                      </div>
                    )}
                  </div>
                </div>
            </div>
            
            {/* Archivos adjuntos */}
            <div className="mt-6 sm:mt-7 pt-4 sm:pt-5 border-t border-slate-100 dark:border-neutral-800">
                <GestorArchivos 
                    tareaId={tarea.id} 
                    archivosIniciales={tarea.archivos} 
                    esLectura={isReadOnly}
                    nombreUsuarioActual={nombreUsuarioActual}
                    municipioId={tarea.municipio_id}
                />
            </div>

            {/* Detalles del registro */}
            <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-100 dark:border-neutral-800">
                <div className="bg-slate-50 dark:bg-neutral-800 rounded-xl p-3 text-xs text-slate-500 dark:text-gray-400 flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b pb-2 border-slate-200 dark:border-neutral-700">
                        <span className="font-bold text-slate-400 dark:text-gray-500 uppercase text-[10px]">Detalles del Registro</span>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10px] text-slate-400 dark:text-gray-500">Creado: {formatearFecha(tarea.created_at)}</span>
                          {tarea.confirmed_at && (
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                              Confirmación: {formatearConfirmadoAt(tarea.confirmed_at)}
                            </span>
                          )}
                          {esSinConfirmar && (
                            <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                              Sin confirmar
                            </span>
                          )}
                        </div>
                      </div>
                      {tarea.es_concejo ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                              <User size={12} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-slate-600 dark:text-gray-400">
                              Actividad asignada por el{' '}
                              <span className="font-bold text-blue-600 dark:text-blue-400">COMUDE</span>
                            </span>
                          </div>
                          {tarea.agenda_titulo && (
                            <div className="flex items-start gap-2 pl-1 text-slate-600 dark:text-gray-400">
                              <Calendar size={13} className="text-slate-400 shrink-0 mt-0.5" />
                              <p className="min-w-0 leading-snug text-xs">
                                <span className="font-semibold text-slate-700 dark:text-gray-300">
                                  {tarea.agenda_titulo}
                                </span>
                                {tarea.agenda_fecha && (
                                  <span className="inline-block whitespace-nowrap text-slate-400 text-xs">
                                    <span className="mx-1.5 text-slate-300 dark:text-gray-600 font-light">|</span>
                                    {formatearSesion(tarea.agenda_fecha)}
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                          {tarea.punto_titulo && (
                            <div className="flex items-start gap-2 pl-1 text-slate-600 dark:text-gray-400">
                              <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
                              <span><span className="text-slate-400">Punto:</span> {tarea.punto_titulo}</span>
                            </div>
                          )}
                        </div>
                      ) : esAutoAsignado ? (
                        <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                                {nombreCreador.charAt(0)}
                            </div>
                            <span className="text-slate-600 dark:text-gray-400">
                                    Creado y asignado por: <span className="font-semibold text-slate-800 dark:text-gray-200">{esAsignadoAMi ? `${nombreAsignado} (Yo)` : nombreAsignado}</span>
                            </span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="shrink-0 w-6 h-6 rounded-full bg-slate-200 dark:bg-neutral-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold">
                                    {nombreCreador.charAt(0)}
                                </div>
                                <span className="truncate" title={tarea.creator?.nombre}>
                                    Creado por: <span className="font-medium text-slate-700 dark:text-gray-300">{nombreCreador}</span>
                                </span>
                            </div>
                            <div className="h-px bg-slate-200 dark:bg-neutral-700 w-full sm:hidden"></div>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center text-[10px] font-bold border border-orange-200 dark:border-orange-800">
                                    {nombreAsignado.charAt(0)}
                                </div>
                                <span className="truncate" title={tarea.assignee?.nombre}>
                                    Encargado: <span className="font-medium text-slate-700 dark:text-gray-300">{esAsignadoAMi ? `${nombreAsignado} (Yo)` : nombreAsignado}</span>
                                </span>
                            </div>
                            {esGrupal && (
                              <div className="flex items-center gap-2">
                                <div className="shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 flex items-center justify-center text-[10px] font-bold border border-purple-200 dark:border-purple-800">
                                  <Users size={10} />
                                </div>
                                <span className="text-slate-600 dark:text-gray-400">
                                  {miembros.length} participante{miembros.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                        </div>
                      )}
                </div>
            </div>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {isEditModalOpen && ( <EditarTarea isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); if (isExpanded && onToggle) { onToggle(); } }} tarea={tarea} esJefe={isJefe} usuarios={usuarios} /> )}
    {isDuplicateModalOpen && ( <DuplicateTarea isOpen={isDuplicateModalOpen} onClose={() => setIsDuplicateModalOpen(false)} tareaOriginal={tarea} usuarios={usuarios} esJefe={isJefe} usuarioActual={usuarioActual} /> )}
    </>
  );
}