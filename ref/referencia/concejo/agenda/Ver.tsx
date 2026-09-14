'use client';

import React, { useEffect, useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useUserData from '@/hooks/sesion/useUserData';
import { eliminarAgenda } from './lib/acciones';
import { useAgendasConcejo } from './lib/hooks';
import { type AgendaConcejo } from './lib/esquemas';
import { obtenerTodasActividadesConcejo } from './tareas/lib/actividades';
import AgendaForm from './forms/Sesion';
import ResumenAsistencia from './modals/ResumenAsistencia';
import InformeDietas from './modals/InformeDietas';
import GestorActa from '@/components/concejo/agenda/gestorActa';
import ListaActividadesAsignadas from './ListaActividadesAsignadas';
import FiltroPeriodoAgenda from './FiltroPeriodoAgenda';
import { CalendarPlus, Pencil, ArrowRight, Trash2, CalendarClock, CalendarDays, CalendarCheck, FileText, Table, FileUp, X, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import CargandoAnimacion from '@/components/ui/animations/Cargando';
import { useRouter } from 'next/navigation';
import { getYear, format, differenceInDays, isToday, isFuture, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import BotonVolver from '@/components/ui/botones/BotonVolver';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

const calcularDiasRestantes = (fechaReunion: string): string => {
  const fecha = new Date(fechaReunion);
  if (isToday(fecha)) return 'Hoy';
  const dias = differenceInDays(fecha, new Date());
  if (dias < 0) return 'Vencido';
  return `${dias + 1} días`;
};

const AgendaCard = memo(({ 
  agenda, 
  isSelected, 
  isLoading, 
  onSelect, 
  onDelete, 
  onEdit, 
  onGoTo, 
  rol, 
  permisos, 
  onSetActa 
}: {
  agenda: AgendaConcejo;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (agenda: AgendaConcejo) => void;
  onGoTo: (id: string) => void;
  rol: string | null;
  permisos: string[];
  onSetActa: (agenda: AgendaConcejo) => void;
}) => {
  let borderColorClass = 'border-l-blue-500 dark:border-l-blue-500';
  let textColorClass = 'text-blue-600 dark:text-blue-400';
  
  if (agenda.estado === 'En progreso') {
    borderColorClass = 'border-l-green-500 dark:border-l-green-500';
    textColorClass = 'text-green-600 dark:text-green-400';
  } else if (agenda.estado === 'Finalizada') {
    borderColorClass = 'border-l-gray-400 dark:border-l-gray-500';
    textColorClass = 'text-gray-500 dark:text-gray-400';
  }

  const esAdmin = ['SUPER', 'SECRETARIO', 'SEC-TECNICO'].includes(rol || '');
  const tienePermisoEditar = permisos.includes('EDITAR') || permisos.includes('TODO');
  
  const puedeEditar = tienePermisoEditar && (rol === 'SUPER' || agenda.estado !== 'Finalizada');
  const puedeEliminar = tienePermisoEditar && (rol === 'SUPER' || agenda.estado === 'En preparación');

const hayActa = Boolean(
  typeof agenda.acta === 'string' && 
  agenda.acta.toLowerCase().includes('.pdf')
);
  const mostrarBotonActa = agenda.estado === 'Finalizada' && (hayActa || esAdmin);
  const textoActa = hayActa ? 'Ver Acta' : 'Subir Acta';
  const IconoActa = hayActa ? FileText : FileUp;

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.2, type: "tween" } }}
      onClick={() => onSelect(agenda.id)}
      className={`group relative bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm border-l-4 ${borderColorClass} flex flex-col overflow-hidden ${isSelected ? 'ring-1 ring-blue-500 dark:ring-blue-400' : ''} cursor-pointer`}
    >
      <div className="flex-1 p-4">
        <div className="flex items-baseline justify-between gap-x-3 flex-wrap">
          <div className="flex items-baseline gap-2">
              <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm md:text-2xl">{agenda.titulo}</p>
              <span className="text-gray-500 dark:text-gray-400 font-normal whitespace-nowrap text-sm md:text-2xl">
              {format(new Date(agenda.fecha_reunion), "EEEE, d 'de' MMMM 'de' yyyy, h:mm a", { locale: es })}
              </span>
          </div>
          <div className="text-gray-400">
              {isSelected ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
        <p className="text-sm md:text-xl mt-2 text-gray-600 dark:text-gray-300 font-normal">{agenda.descripcion}</p>
        <p className="text-sm md:text-xl mt-2">
          <span className={`font-bold ${textColorClass}`}>{agenda.estado}</span>,{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {calcularDiasRestantes(agenda.fecha_reunion)}
            {calcularDiasRestantes(agenda.fecha_reunion).includes('días') && ' restantes'}
          </span>
        </p>
      </div>

      <AnimatePresence initial={false}>
        {isSelected && (
          <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
          >
              <div className="border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-black/20 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        {puedeEliminar && (
                            <Button 
                                onClick={(e) => { e.stopPropagation(); onDelete(agenda.id); }} 
                                variant="ghost" 
                                className="text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 px-3 h-9"
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {puedeEditar && (
                            <Button 
                                onClick={(e) => { e.stopPropagation(); onEdit(agenda); }} 
                                variant="ghost" 
                                className="text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 px-3 h-9"
                            >
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                            </Button>
                        )}

                        {mostrarBotonActa && (
                            <Button 
                                onClick={(e) => { e.stopPropagation(); onSetActa(agenda); }} 
                                variant="ghost" 
                                className={`px-3 h-9 ${
                                    hayActa 
                                    ? 'text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30' 
                                    : 'text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30'
                                }`}
                            >
                                <IconoActa className="h-4 w-4 mr-2" /> {textoActa}
                            </Button>
                        )}

                        <Button 
                            onClick={(e) => { e.stopPropagation(); onGoTo(agenda.id); }} 
                            variant="ghost"
                             className="h-10 px-4 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50 gap-2 font-medium"
                        >
                            Entrar <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

AgendaCard.displayName = 'AgendaCard';

type VistaType = 'hoy' | 'proximas' | 'terminadas' | 'actividades';

const ACTIVIDADES_QUERY_KEY = ['actividades-concejo-todas', 'v3'] as const;

export default function Ver() {
  const router = useRouter();
  const { permisos, rol, cargando: cargandoUsuario } = useUserData();
  const { agendas, cargando: cargandoAgendas, error, fetchAgendas } = useAgendasConcejo();
  const { data: actividades = [], isLoading: cargandoActividades, isError: errorActividades } = useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: obtenerTodasActividadesConcejo,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
  const hayActividades = actividades.length > 0;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResumenOpen, setIsResumenOpen] = useState(false);
  const [isInformeOpen, setIsInformeOpen] = useState(false);
  const [agendaAEditar, setAgendaAEditar] = useState<AgendaConcejo | null>(null);
  const [agendaParaActa, setAgendaParaActa] = useState<AgendaConcejo | null>(null);
  const [filtroAnio, setFiltroAnio] = useState<string>(getYear(new Date()).toString());
  const [filtroMes, setFiltroMes] = useState<string | null>(null);

  useEffect(() => {
    const savedAnio = localStorage.getItem('agenda_filtroAnio');
    if (savedAnio) setFiltroAnio(savedAnio);
    
    const savedMes = localStorage.getItem('agenda_filtroMes');
    if (savedMes) setFiltroMes(savedMes);
  }, []);

  useEffect(() => {
    if (filtroAnio) {
      localStorage.setItem('agenda_filtroAnio', filtroAnio);
    }
  }, [filtroAnio]);

  useEffect(() => {
    if (filtroMes === null) {
      localStorage.removeItem('agenda_filtroMes');
    } else {
      localStorage.setItem('agenda_filtroMes', filtroMes);
    }
  }, [filtroMes]);
  
  const [loadingAgendaId, setLoadingAgendaId] = useState<string | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);
  
  const [vista, setVista] = useState<VistaType>('hoy');
  const [haCargadoVistaInicial, setHaCargadoVistaInicial] = useState(false);

  const agendasFiltradasBase = useMemo(() => {
    return agendas.filter(agenda => {
      const agendaDate = new Date(agenda.fecha_reunion);
      const agendaYear = agendaDate.getFullYear().toString();
      const agendaMonth = agendaDate.getMonth().toString();
      const cumpleAnio = filtroAnio === '' || agendaYear === filtroAnio;
      const cumpleMes = filtroMes === null || agendaMonth === filtroMes;
      return cumpleAnio && cumpleMes;
    });
  }, [agendas, filtroAnio, filtroMes]);

  const counts = useMemo(() => {
    let hoy = 0;
    let proximas = 0;
    let terminadas = 0;
    agendasFiltradasBase.forEach(a => {
      const fecha = new Date(a.fecha_reunion);
      if (isToday(fecha)) hoy++;
      else if (isFuture(fecha)) proximas++;
      else if (isPast(fecha)) terminadas++;
    });
    return { hoy, proximas, terminadas };
  }, [agendasFiltradasBase]);

  useEffect(() => {
    if (cargandoAgendas) return;
    const vistaActualEstaVacia = 
      (vista === 'hoy' && counts.hoy === 0) ||
      (vista === 'proximas' && counts.proximas === 0) ||
      (vista === 'terminadas' && counts.terminadas === 0);

    if (!haCargadoVistaInicial || vistaActualEstaVacia) {
      if (counts.hoy > 0) setVista('hoy');
      else if (counts.proximas > 0) setVista('proximas');
      else if (counts.terminadas > 0) setVista('terminadas');
      else setVista('hoy');
      if (!haCargadoVistaInicial) setHaCargadoVistaInicial(true);
    }
  }, [counts, vista, haCargadoVistaInicial, cargandoAgendas]);

  useEffect(() => {
    if (cargandoActividades || hayActividades || vista !== 'actividades') return;
    if (counts.hoy > 0) setVista('hoy');
    else if (counts.proximas > 0) setVista('proximas');
    else if (counts.terminadas > 0) setVista('terminadas');
    else setVista('hoy');
  }, [cargandoActividades, hayActividades, vista, counts]);

  const agendasVisibles = useMemo(() => {
    let lista: AgendaConcejo[] = [];
    if (vista === 'hoy') {
      lista = agendasFiltradasBase.filter(a => isToday(new Date(a.fecha_reunion)));
    } else if (vista === 'proximas') {
      lista = agendasFiltradasBase.filter(a => isFuture(new Date(a.fecha_reunion)) && !isToday(new Date(a.fecha_reunion)));
      lista.sort((a, b) => new Date(a.fecha_reunion).getTime() - new Date(b.fecha_reunion).getTime());
    } else {
      lista = agendasFiltradasBase.filter(a => isPast(new Date(a.fecha_reunion)) && !isToday(new Date(a.fecha_reunion)));
      lista.sort((a, b) => new Date(b.fecha_reunion).getTime() - new Date(a.fecha_reunion).getTime());
    }
    return lista;
  }, [vista, agendasFiltradasBase]);

  useEffect(() => {
    if (isModalOpen) document.body.classList.add('overflow-hidden');
    else document.body.classList.remove('overflow-hidden');
    return () => { document.body.classList.remove('overflow-hidden'); };
  }, [isModalOpen]);

  const handleOpenEditModal = (agenda: AgendaConcejo) => {
    setAgendaAEditar(agenda);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setAgendaAEditar(null);
  };

  const handleGoToAgenda = (id: string) => {
    setLoadingAgendaId(id);
    setTimeout(() => { router.push(`/protected/concejo/agenda/${id}`); }, 1000);
  };

  const handleDeleteAgenda = async (id: string) => {
    const result = await Swal.fire({
      title: '¿Está seguro?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      const exito = await eliminarAgenda(id);
      if (exito) fetchAgendas();
    }
  };

  const handleCardClick = (id: string) => {
    if (loadingAgendaId) return;
    if (selectedAgendaId === id) {
      setSelectedAgendaId(null);
    } else {
      setSelectedAgendaId(id);
    }
  };

  if (cargandoUsuario || cargandoAgendas) return <CargandoAnimacion texto="Cargando Agenda..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400"><p>{error}</p></div>;

  return (
    <div className="container min-w-0 max-w-full px-2 md:mx-auto">

      <header className="w-full min-w-0 flex flex-col gap-4 mt-2 md:mb-6">
        
        <div className="w-full flex flex-col gap-3 xl:flex-row xl:items-center">
            
            <div className="flex w-full xl:w-auto items-center gap-3">
                <BotonVolver ruta="/protected/" />
                
                <FiltroPeriodoAgenda
                  filtroAnio={filtroAnio}
                  filtroMes={filtroMes}
                  onChangeAnio={setFiltroAnio}
                  onChangeMes={setFiltroMes}
                />
            </div>


            <div className="flex flex-wrap items-center justify-center gap-2 w-full xl:w-auto xl:ml-auto">
                <Button onClick={() => setIsResumenOpen(true)} variant="ghost" size="sm" className="h-10 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 gap-2 border border-gray-100 dark:border-neutral-800 xl:border-none">
                    <Table size={16} /> <span className="text-xs sm:text-sm">Resumen de asistencia</span>
                </Button>
                <Button onClick={() => setIsInformeOpen(true)} variant="ghost" size="sm" className="h-10 px-2 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50 gap-2 border border-gray-100 dark:border-neutral-800 xl:border-none">
                    <FileText size={16} /> <span className="text-xs sm:text-sm">Informe Pago DAFIM</span>
                </Button>
                {(permisos.includes('EDITAR') || permisos.includes('TODO')) && (
                    <Button 
                    onClick={() => { setAgendaAEditar(null); setIsModalOpen(true); }} 
                    variant="ghost" 
                    className="h-10 px-2 border-2 border-green-600 dark:border-green-400 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50 gap-2 font-semibold"
                    >
                    <CalendarPlus size={18} /> <span className="text-xs sm:text-sm">Nueva Sesión</span>
                    </Button>
                )}
            </div>
        </div>

        <div className="w-full min-w-0 border-t border-gray-100 dark:border-neutral-800 pt-2 xl:border-none xl:pt-0">
            <div className="flex items-center gap-1 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 xl:overflow-x-visible">
                {(counts.hoy > 0 || vista === 'hoy') && (
                    <button onClick={() => setVista('hoy')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'hoy' ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>
                        <CalendarClock className="h-4 w-4" /> <span>Hoy ({counts.hoy})</span>
                        {vista === 'hoy' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 dark:bg-blue-400" />}
                    </button>
                )}
                {(counts.proximas > 0 || vista === 'proximas') && (
                    <button onClick={() => setVista('proximas')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'proximas' ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>
                        <CalendarDays className="h-4 w-4" /> <span>Próximas ({counts.proximas})</span>
                        {vista === 'proximas' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400" />}
                    </button>
                )}
                {(counts.terminadas > 0 || vista === 'terminadas') && (
                    <button onClick={() => setVista('terminadas')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'terminadas' ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>
                        <CalendarCheck className="h-4 w-4" /> <span>Terminadas ({counts.terminadas})</span>
                        {vista === 'terminadas' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-600 dark:bg-red-400" />}
                    </button>
                )}
                {(hayActividades || vista === 'actividades' || cargandoActividades) && !errorActividades && (
                    <button onClick={() => setVista('actividades')} className={cn("relative flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors whitespace-nowrap", vista === 'actividades' ? "text-purple-600 dark:text-purple-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>
                        <ClipboardList className="h-4 w-4" /> <span>Actividades Asignadas</span>
                        {vista === 'actividades' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-600 dark:bg-purple-400" />}
                    </button>
                )}
            </div>
        </div>

      </header>
      <div className="w-full">
        {vista === 'actividades' && hayActividades ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="actividades"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ListaActividadesAsignadas filtroAnio={filtroAnio} filtroMes={filtroMes} />
            </motion.div>
          </AnimatePresence>
        ) : agendasVisibles.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-neutral-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Aún no hay sesiones disponibles en esta vista.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={vista}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-4"
            >
              {agendasVisibles.map(agenda => (
                <AgendaCard
                  key={agenda.id}
                  agenda={agenda}
                  isSelected={selectedAgendaId === agenda.id}
                  isLoading={loadingAgendaId === agenda.id}
                  onSelect={handleCardClick}
                  onDelete={handleDeleteAgenda}
                  onEdit={handleOpenEditModal}
                  onGoTo={handleGoToAgenda}
                  rol={rol}
                  permisos={permisos}
                  onSetActa={(a) => setAgendaParaActa(a)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {agendaParaActa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0 backdrop-blur-sm">
          <div className="relative w-full h-full max-w-none flex flex-col rounded-none bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0 z-10">
              <div className="pr-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {agendaParaActa.titulo}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {agendaParaActa.descripcion}
                </p>
              </div>
              <button 
                onClick={() => {
                  setAgendaParaActa(null);
                  fetchAgendas();
                }}
                className="text-gray-400 hover:text-white hover:bg-red-600 transition-colors bg-gray-100 dark:bg-gray-800 p-2 rounded-full shrink-0"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-neutral-950 relative">
              <GestorActa 
                agendaId={agendaParaActa.id}
                currentActaPath={agendaParaActa.acta}
                rol={rol}
                estadoAgenda={agendaParaActa.estado}
                onUpdate={(nuevoPath) => {
                  setAgendaParaActa({ ...agendaParaActa, acta: nuevoPath });
                  fetchAgendas(); 
                }}
              />
            </div>
          </div>
        </div>
      )}

       <AnimatePresence>
        {isModalOpen && (
          <AgendaForm isOpen={isModalOpen} onClose={handleCloseModal} onSave={() => { fetchAgendas(); }} agendaAEditar={agendaAEditar} />
        )}
      </AnimatePresence>

      <ResumenAsistencia isOpen={isResumenOpen} onClose={() => setIsResumenOpen(false)} agendas={agendas} />
      <InformeDietas isOpen={isInformeOpen} onClose={() => setIsInformeOpen(false)} agendas={agendas} />
    </div>
  );
}