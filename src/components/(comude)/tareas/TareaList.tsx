'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Tarea, Usuario, PerfilUsuario, TipoVistaTareas } from './lib/zod'; 
import TareaItem from './TareaItem';
import NewTarea from './modals/NewTarea'; 
import { Plus, SearchX, ArrowLeft, Search, Building2, ChevronDown, ChevronLeft, ChevronRight, User, ArrowDownWideNarrow, ArrowUpWideNarrow, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { useGestorData } from './lib/hooks';
import SelectorMesAnio from './SelectorMesAnio';

interface Props {
  initialData: {
      tareas: Tarea[];
      usuarios: Usuario[];
      perfil: PerfilUsuario;
  };
  tipoVista: TipoVistaTareas;
}

const ANIO_ACTUAL = new Date().getFullYear();

const rangoMesActual = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const getWeekDays = (date: Date) =>
  eachDayOfInterval({
    start: startOfWeek(date, { locale: es, weekStartsOn: 1 }),
    end: endOfWeek(date, { locale: es, weekStartsOn: 1 }),
  });

const semanaInicialDelMes = (mes: number, anio: number) => {
  const ahora = new Date();
  if (mes === ahora.getMonth() && anio === ahora.getFullYear()) return ahora;
  return new Date(anio, mes, 1);
};

const getFechaCabecera = (fechaIso: string) => {
  if (!fechaIso) return 'Sin fecha';
  const fechaParte = fechaIso.split('T')[0];
  const [year, month, day] = fechaParte.split('-').map(Number);
  const fecha = new Date(year, month - 1, day);
  const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric' };
  const str = new Intl.DateTimeFormat('es-ES', opciones).format(fecha);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

interface TareaCardProps {
  tarea: Tarea;
  isExpanded: boolean;
  onToggle: () => void;
  isJefe: boolean;
  isRRHH?: boolean;
  usuarioActual: string;
  nombreUsuarioActual: string;
  usuarios: Usuario[];
}

function TareaCard(props: TareaCardProps) {
  return <TareaItem {...props} />;
}

type FiltroOrigen = 'Internas' | 'Concejo' | 'Comisiones' | 'Vencidas';

const ORIGEN_STYLES: Record<FiltroOrigen, { active: string; inactive: string; badge: string }> = {
  Internas: {
    active: 'bg-purple-600 text-white shadow-sm',
    inactive: 'text-purple-600 bg-purple-50 hover:bg-purple-100/70 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
  },
  Concejo: {
    active: 'bg-blue-600 text-white shadow-sm',
    inactive: 'text-blue-600 bg-blue-50 hover:bg-blue-100/70 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  },
  Comisiones: {
    active: 'bg-teal-600 text-white shadow-sm',
    inactive: 'text-teal-600 bg-teal-50 hover:bg-teal-100/70 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/50',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300',
  },
  Vencidas: {
    active: 'bg-rose-600 text-white shadow-sm',
    inactive: 'text-rose-600 bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
  },
};

const ORIGEN_LABELS: Record<FiltroOrigen, string> = {
  Internas: 'Internas',
  Concejo: 'COMUDE',
  Comisiones: 'Comisiones',
  Vencidas: 'Vencidas',
};

const ORIGEN_ORDEN: FiltroOrigen[] = ['Internas', 'Concejo', 'Comisiones', 'Vencidas'];

const ALCANCE_JEFE_STYLES: Record<string, { active: string, inactive: string, badge: string }> = {
  'equipo': { active: 'bg-blue-600 text-white', inactive: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400', badge: 'bg-blue-100 text-blue-700' },
  'externa': { active: 'bg-amber-600 text-white', inactive: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', badge: 'bg-amber-100 text-amber-700' },
};

export default function TareaList({ initialData, tipoVista }: Props) {
  const { data } = useGestorData(tipoVista, initialData);
  
  const tareas = (data?.tareas || []) as Tarea[];
  const usuarios = (data?.usuarios || []) as Usuario[];
  const perfilUsuario = (data?.perfil || initialData.perfil) as PerfilUsuario;

  const [isMounted, setIsMounted] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroOrigen>('Internas');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState(0); 
  const [anioSeleccionado, setAnioSeleccionado] = useState(ANIO_ACTUAL);
  const [semanaVista, setSemanaVista] = useState(() => new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | undefined>(undefined);
  const [filtroTipo, setFiltroTipo] = useState<'mes' | 'rango'>('mes');
  const [fechaInicialRango, setFechaInicialRango] = useState(() => rangoMesActual().start);
  const [fechaFinalRango, setFechaFinalRango] = useState(() => rangoMesActual().end);
  const [ordenDescendente, setOrdenDescendente] = useState(true);
  const [alcanceJefe, setAlcanceJefe] = useState<'equipo' | 'externa'>('equipo');
  
  const [oficinasAbiertas, setOficinasAbiertas] = useState<Record<string, boolean>>({});
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    setMesSeleccionado(mes);
    setAnioSeleccionado(anio);
    setSemanaVista(hoy);
    setIsMounted(true);
  }, []);

  const fechaReferencia = useMemo(
    () => new Date(anioSeleccionado, mesSeleccionado, 1),
    [mesSeleccionado, anioSeleccionado],
  );

  const diasDeLaSemana = useMemo(() => getWeekDays(semanaVista), [semanaVista]);

  const puedeSemanaAnterior = useMemo(() => {
    const inicioMes = startOfMonth(fechaReferencia);
    return startOfWeek(semanaVista, { locale: es, weekStartsOn: 1 }) >
      startOfWeek(inicioMes, { locale: es, weekStartsOn: 1 });
  }, [semanaVista, fechaReferencia]);

  const puedeSemanaSiguiente = useMemo(() => {
    const finMes = endOfMonth(fechaReferencia);
    return startOfWeek(semanaVista, { locale: es, weekStartsOn: 1 }) <
      startOfWeek(finMes, { locale: es, weekStartsOn: 1 });
  }, [semanaVista, fechaReferencia]);

  const handleSeleccionMes = (mes: number, anio: number) => {
    setMesSeleccionado(mes);
    setAnioSeleccionado(anio);
    setSemanaVista(semanaInicialDelMes(mes, anio));
    setDiaSeleccionado(undefined);
  };

  const handleFiltroTipoClick = (tipo: 'mes' | 'rango') => {
    setFiltroTipo(tipo);
    setDiaSeleccionado(undefined);
    if (tipo === 'rango') {
      const { start, end } = rangoMesActual();
      setFechaInicialRango(start);
      setFechaFinalRango(end);
    } else {
      setSemanaVista(semanaInicialDelMes(mesSeleccionado, anioSeleccionado));
    }
  };

  const handleSeleccionDia = (dia: Date) => {
    if (!isSameMonth(dia, fechaReferencia)) return;
    if (diaSeleccionado && isSameDay(dia, diaSeleccionado)) {
      setDiaSeleccionado(undefined);
      return;
    }
    setDiaSeleccionado(dia);
  };

  const toggleAccordion = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    else {
        scrollPositionRef.current = window.scrollY;
        setExpandedId(id);
        window.scrollTo({ top: 0, behavior: 'instant' }); 
    }
  };

  const toggleOficina = (nombre: string) => {
    setOficinasAbiertas(prev => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  useEffect(() => {
    if (expandedId === null) window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
  }, [expandedId]);

  const tareasPorAlcance = useMemo(() => {
    if (tipoVista !== 'gestion_jefe') return tareas;
    return tareas.filter((t: Tarea) => (t.alcance || 'equipo') === alcanceJefe);
  }, [tareas, tipoVista, alcanceJefe]);

  const conteosAlcanceJefe = useMemo(() => {
    if (tipoVista !== 'gestion_jefe') return { equipo: 0, externa: 0 };
    return {
      equipo: tareas.filter((t: Tarea) => (t.alcance || 'equipo') === 'equipo').length,
      externa: tareas.filter((t: Tarea) => t.alcance === 'externa').length,
    };
  }, [tareas, tipoVista]);

  useEffect(() => {
    if (tipoVista === 'gestion_jefe' && isMounted && alcanceJefe === 'equipo' && conteosAlcanceJefe.equipo === 0 && conteosAlcanceJefe.externa > 0) {
      setAlcanceJefe('externa');
    }
  }, [tipoVista, isMounted, alcanceJefe, conteosAlcanceJefe]);

  useEffect(() => {
    setFiltroEstado('Internas');
  }, [alcanceJefe]);

  const tareasFiltradas = useMemo(() => {
    if (!isMounted) return [];

    return tareasPorAlcance.filter((t: Tarea) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      const tYear = d.getFullYear();
      const tMonth = d.getMonth() + 1;
      const tDay = d.getDate();
      const tDate = new Date(tYear, tMonth - 1, tDay);

      let coincideFecha = false;
      if (filtroTipo === 'rango') {
          if (!fechaInicialRango || !fechaFinalRango) return false;
          const inicio = parseISO(fechaInicialRango + 'T00:00:00');
          const fin = parseISO(fechaFinalRango + 'T00:00:00');
          coincideFecha = tDate >= inicio && tDate <= fin;
      } else if (diaSeleccionado) {
          coincideFecha = isSameDay(tDate, diaSeleccionado);
      } else {
          coincideFecha = (tMonth - 1) === mesSeleccionado && tYear === anioSeleccionado;
      }
      
      const termino = busqueda.toLowerCase();
      const coincideTitulo = t.title.toLowerCase().includes(termino);
      const coincideUsuario = (t.assignee?.nombre || '').toLowerCase().includes(termino);
      
      return coincideFecha && (coincideTitulo || coincideUsuario);
    }).map((t: Tarea) => {
      const esVencida = new Date() > new Date(t.due_date) && t.status !== 'Completado';
      return { ...t, estadoFiltro: esVencida ? 'Vencido' : t.status };
    });
  }, [tareasPorAlcance, mesSeleccionado, anioSeleccionado, diaSeleccionado, filtroTipo, fechaInicialRango, fechaFinalRango, busqueda, isMounted]);

  const conteoPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    tareasPorAlcance.forEach((t: Tarea) => {
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      const key = format(d, 'yyyy-MM-dd');
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [tareasPorAlcance]);

  const conteos = useMemo(() => ({
    Internas: tareasFiltradas.filter((t: Tarea) => !t.es_concejo && !t.comision_id && t.estadoFiltro !== 'Vencido').length,
    Comisiones: tareasFiltradas.filter((t: Tarea) => !!t.comision_id && t.estadoFiltro !== 'Vencido').length,
    Concejo: tareasFiltradas.filter((t: Tarea) => !!t.es_concejo && t.estadoFiltro !== 'Vencido').length,
    Vencidas: tareasFiltradas.filter((t: Tarea) => t.estadoFiltro === 'Vencido').length,
  }), [tareasFiltradas]);

  const ordenarPorFecha = (lista: Tarea[]) => {
    return [...lista].sort((a, b) => {
      const prioridad = (t: Tarea) => {
        if (t.status !== 'Completado' && !t.confirmed_at) return 2;
        return 0;
      };
      const prioA = prioridad(a);
      const prioB = prioridad(b);
      if (prioB !== prioA) return prioB - prioA;

      const cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      return ordenDescendente ? -cmp : cmp;
    });
  };

  const listaVisual = useMemo(() => {
      const filtradas = tareasFiltradas.filter((t: Tarea) => {
        if (filtroEstado === 'Internas') return !t.es_concejo && !t.comision_id && t.estadoFiltro !== 'Vencido';
        if (filtroEstado === 'Comisiones') return !!t.comision_id && t.estadoFiltro !== 'Vencido';
        if (filtroEstado === 'Concejo') return !!t.es_concejo && t.estadoFiltro !== 'Vencido';
        return t.estadoFiltro === 'Vencido';
      });
      return ordenarPorFecha(filtradas);
  }, [tareasFiltradas, filtroEstado, ordenDescendente]);
  
  const tareasRenderizadas = useMemo(() => {
      return expandedId ? listaVisual.filter((t: Tarea) => t.id === expandedId) : listaVisual;
  }, [expandedId, listaVisual]);

  const tareasAgrupadas = useMemo(() => {
      if (!isMounted) return [];

      if (tipoVista === 'mis_actividades') {
          const grupos: any[] = [];
          tareasRenderizadas.forEach((t: Tarea) => {
              const d = new Date(t.due_date);
              const localYear = d.getFullYear();
              const localMonth = String(d.getMonth() + 1).padStart(2, '0');
              const localDay = String(d.getDate()).padStart(2, '0');
              const fechaKey = `${localYear}-${localMonth}-${localDay}`;
              let g = grupos.find(x => x.key === fechaKey);
              if (!g) { g = { key: fechaKey, titulo: getFechaCabecera(fechaKey), tareas: [] }; grupos.push(g); }
              g.tareas.push(t);
          });
          return grupos
            .sort((a, b) => ordenDescendente ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key))
            .map((g) => ({ ...g, tareas: ordenarPorFecha(g.tareas) }));
      } else {
          const usarSubgruposPersona =
            (tipoVista === 'gestion_jefe' && alcanceJefe === 'equipo') ||
            tipoVista === 'gestion_rrhh';
          const grupos: Record<string, {
            key: string;
            titulo: string;
            tareas: Tarea[];
            subgrupos: Record<string, { key: string; nombre: string; tareas: Tarea[] }>;
          }> = {};

          if (tipoVista === 'gestion_jefe' && alcanceJefe === 'equipo') {
              perfilUsuario.oficinasACargo.forEach(of => {
                  grupos[of.nombre] = { key: of.nombre, titulo: of.nombre, tareas: [], subgrupos: {} };
              });
          }

          tareasRenderizadas.forEach((t: Tarea) => {
              const ofName = t.assignee?.oficina_nombre || 'Sin Dependencia Asignada';
              if (!grupos[ofName]) {
                  grupos[ofName] = { key: ofName, titulo: ofName, tareas: [], subgrupos: {} };
              }

              if (usarSubgruposPersona) {
                  const personKey = t.assigned_to || 'sin-asignar';
                  const personName = t.assignee?.nombre || 'Sin asignar';
                  if (!grupos[ofName].subgrupos[personKey]) {
                      grupos[ofName].subgrupos[personKey] = { key: personKey, nombre: personName, tareas: [] };
                  }
                  grupos[ofName].subgrupos[personKey].tareas.push(t);
              } else {
                  grupos[ofName].tareas.push(t);
              }
          });

          return Object.values(grupos)
            .filter(g => usarSubgruposPersona ? Object.keys(g.subgrupos).length > 0 : g.tareas.length > 0)
            .map(g => ({
              key: g.key,
              titulo: g.titulo,
              subgrupos: usarSubgruposPersona
                ? Object.values(g.subgrupos)
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map((s) => ({ ...s, tareas: ordenarPorFecha(s.tareas) }))
                : undefined,
              tareas: usarSubgruposPersona
                ? Object.values(g.subgrupos).flatMap(s => ordenarPorFecha(s.tareas))
                : ordenarPorFecha(g.tareas),
            }))
            .sort((a, b) => a.titulo.localeCompare(b.titulo));
      }
  }, [tareasRenderizadas, tipoVista, perfilUsuario, isMounted, alcanceJefe, ordenDescendente]);

  const todasAbiertas = useMemo(() => {
    if (!tareasAgrupadas.length) return false;
    return tareasAgrupadas.every((g: any) => Boolean(oficinasAbiertas[g.key]));
  }, [tareasAgrupadas, oficinasAbiertas]);

  const toggleTodasOficinas = () => {
    if (todasAbiertas) {
      setOficinasAbiertas({});
    } else {
      const nuevo: Record<string, boolean> = {};
      tareasAgrupadas.forEach((g: any) => {
        nuevo[g.key] = true;
      });
      setOficinasAbiertas(nuevo);
    }
  };

  const tituloPagina = useMemo(() => {
      if (tipoVista === 'mis_actividades') return 'Mis Actividades';
      if (tipoVista === 'gestion_jefe') return `Actividades de mi Equipo (${perfilUsuario.nombre})`;
      if (tipoVista === 'gestion_rrhh') return 'Actividades Globales';
      return 'Actividades';
  }, [tipoVista, perfilUsuario]);

  if (!isMounted) return <div className="w-full h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="max-w-[1600px] w-full mx-auto px-1 sm:px-6 lg:px-8 flex flex-col gap-3 sm:gap-4 pb-20 mt-2 sm:mt-7">
      {!expandedId && (
        <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-center gap-3 sm:gap-4 text-center sm:text-left">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{tituloPagina}</h1>
                    <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">
                        {tipoVista === 'mis_actividades'
                          ? 'Gestiona tus prioridades del día'
                          : tipoVista === 'gestion_jefe' && alcanceJefe === 'externa'
                            ? 'Actividades que asignaste a otras oficinas'
                            : tipoVista === 'gestion_rrhh'
                              ? 'Supervisa las actividades institucionales divididas por dependencia'
                              : 'Actividades asignadas a los integrantes de tu equipo'}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80 md:w-[500px] group">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input type="text" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 dark:text-gray-200" />
                    </div>
                    {(tipoVista === 'mis_actividades' ||
                      (tipoVista === 'gestion_jefe' && perfilUsuario.esJefe) ||
                      (tipoVista === 'gestion_rrhh' && perfilUsuario.esSupervisor)) && (
                        <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white transition-all shadow-sm whitespace-nowrap cursor-pointer">
                            <Plus size={16} /> Nueva Actividad
                        </button>
                    )}
                </div>
            </div>

            {tipoVista === 'gestion_jefe' && (conteosAlcanceJefe.equipo > 0 || conteosAlcanceJefe.externa > 0) && (
                <div className="w-full">
                    <div className="flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 p-1 rounded-lg border border-slate-200 dark:border-neutral-800 w-full xl:w-fit">
                        {([
                          { key: 'equipo' as const, label: 'Mi equipo' },
                          { key: 'externa' as const, label: 'Otras oficinas' },
                        ]).map(({ key, label }) => {
                            const styles = ALCANCE_JEFE_STYLES[key];
                            const isActive = alcanceJefe === key;
                            const count = conteosAlcanceJefe[key];
                            return (
                                <button
                                  key={key}
                                  onClick={() => setAlcanceJefe(key)}
                                  className={`flex flex-1 xl:flex-none items-center justify-center gap-2 px-3 sm:px-4 h-8 rounded-md text-xs font-bold transition-all cursor-pointer ${isActive ? styles.active : styles.inactive}`}
                                >
                                    <span className="truncate">{label}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] min-w-[18px] text-center shrink-0 ${isActive ? 'bg-white/20 text-white' : styles.badge}`}>
                                      {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3.5 w-full">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 w-full">
                    {/* Filtros de origen de actividad */}
                    <div className="flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 p-1 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-xs overflow-x-auto w-full sm:w-auto">
                        {ORIGEN_ORDEN.map((tab) => {
                            const styles = ORIGEN_STYLES[tab];
                            const isActive = filtroEstado === tab;
                            return (
                                <button
                                  key={tab}
                                  onClick={() => setFiltroEstado(tab)}
                                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 h-8 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap uppercase tracking-tight cursor-pointer ${isActive ? styles.active : styles.inactive}`}
                                >
                                    <span>{ORIGEN_LABELS[tab]}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] min-w-[17px] text-center font-extrabold shrink-0 ${isActive ? 'bg-white/20 text-white' : styles.badge}`}>
                                      {conteos[tab]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selector de Rango/Mes y Orden */}
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full lg:w-auto justify-between lg:justify-end">
                        {/* Toggle Mes / Rango */}
                        <div className="grid grid-cols-2 gap-0.5 bg-white/90 dark:bg-neutral-900/90 p-0.5 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-xs h-9 w-28 sm:w-36 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleFiltroTipoClick('mes')}
                            className={`h-full rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                              filtroTipo === 'mes'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Mes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFiltroTipoClick('rango')}
                            className={`h-full rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                              filtroTipo === 'rango'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Rango
                          </button>
                        </div>

                        {/* Selector dinámico de fecha */}
                        <div className="relative flex-1 sm:flex-initial flex items-center h-9 min-w-0">
                          <AnimatePresence mode="wait" initial={false}>
                            {filtroTipo === 'mes' ? (
                              <motion.div
                                key="selector-mes"
                                initial={{ opacity: 0, x: -12, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, x: 12, filter: 'blur(4px)' }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                className="flex items-center justify-between w-full sm:w-auto h-full rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 px-0.5 shadow-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const d = new Date(anioSeleccionado, mesSeleccionado - 1, 1);
                                    handleSeleccionMes(d.getMonth(), d.getFullYear());
                                  }}
                                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-neutral-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  aria-label="Mes anterior"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <SelectorMesAnio
                                  className="!w-full xl:!w-auto !h-full !border-0 !rounded-lg !bg-transparent dark:!bg-transparent [&_button]:!h-full [&_button]:!py-0 [&_button]:!w-full font-semibold text-xs"
                                  mes={mesSeleccionado}
                                  anio={anioSeleccionado}
                                  mostrarFlechas={false}
                                  onChange={handleSeleccionMes}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const d = new Date(anioSeleccionado, mesSeleccionado + 1, 1);
                                    handleSeleccionMes(d.getMonth(), d.getFullYear());
                                  }}
                                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-neutral-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  aria-label="Mes siguiente"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="selector-rango"
                                initial={{ opacity: 0, x: 12, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, x: -12, filter: 'blur(4px)' }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                className="flex items-center gap-1.5 h-full bg-white/90 dark:bg-neutral-900/90 p-0.5 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-xs"
                              >
                                <Input
                                  type="date"
                                  value={fechaInicialRango}
                                  onChange={(e) => setFechaInicialRango(e.target.value)}
                                  className="w-[8rem] text-[11px] h-8 px-2 py-0 border-0 focus-visible:ring-0 bg-slate-50 dark:bg-neutral-800 dark:text-gray-100 rounded-lg"
                                />
                                <span className="text-slate-400 text-xs shrink-0 font-medium">a</span>
                                <Input
                                  type="date"
                                  value={fechaFinalRango}
                                  onChange={(e) => setFechaFinalRango(e.target.value)}
                                  className="w-[8rem] text-[11px] h-8 px-2 py-0 border-0 focus-visible:ring-0 bg-slate-50 dark:bg-neutral-800 dark:text-gray-100 rounded-lg"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Botón de Ordenamiento */}
                        <button
                          type="button"
                          onClick={() => setOrdenDescendente((prev) => !prev)}
                          title={ordenDescendente ? 'Más recientes primero' : 'Más antiguas primero'}
                          className="h-9 w-9 shrink-0 flex items-center justify-center bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-xs cursor-pointer active:scale-95"
                        >
                          {ordenDescendente ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
                        </button>
                    </div>
                </div>

                <AnimatePresence initial={false}>
                  {filtroTipo === 'mes' && (
                    <motion.div
                      key="franja-dias"
                      initial={{ opacity: 0, height: 0, y: -6 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden w-full pt-1"
                    >
                      <div className="flex items-center justify-center w-full">
                        <div className="flex items-center gap-1 sm:gap-2 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/80 backdrop-blur-sm p-1 sm:p-1.5 shadow-xs w-full max-w-xl mx-auto">
                          <button
                            type="button"
                            onClick={() => {
                              if (!puedeSemanaAnterior) return;
                              setSemanaVista((prev) => subWeeks(prev, 1));
                              setDiaSeleccionado(undefined);
                            }}
                            disabled={!puedeSemanaAnterior}
                            className="p-1 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                            aria-label="Semana anterior"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <div className="flex items-center justify-between flex-1 min-w-0 gap-0.5 sm:gap-1.5">
                            {diasDeLaSemana.map((dia) => {
                              const diaStr = format(dia, 'yyyy-MM-dd');
                              const delMes = isSameMonth(dia, fechaReferencia);
                              const esDiaSeleccionado = Boolean(diaSeleccionado && isSameDay(dia, diaSeleccionado));
                              const tieneActividad = delMes && (conteoPorDia[diaStr] || 0) > 0;
                              return (
                                <button
                                  type="button"
                                  key={dia.toString()}
                                  onClick={() => handleSeleccionDia(dia)}
                                  disabled={!delMes}
                                  className={`relative flex flex-1 flex-col items-center justify-center min-w-0 h-11 sm:h-12 rounded-xl transition-all duration-200 border ${
                                    !delMes
                                      ? 'bg-transparent text-slate-300 border-transparent dark:text-neutral-700 cursor-not-allowed'
                                      : esDiaSeleccionado
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 font-bold cursor-pointer'
                                        : 'bg-transparent text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-100 dark:hover:bg-neutral-800/80 cursor-pointer'
                                  }`}
                                >
                                  {tieneActividad && (
                                    <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${esDiaSeleccionado ? 'bg-white' : 'bg-blue-500'}`} />
                                  )}
                                  <span className="text-[10px] uppercase font-semibold leading-none tracking-wide">
                                    {format(dia, 'eee', { locale: es })}
                                  </span>
                                  <span className="text-xs font-bold leading-tight mt-0.5">{format(dia, 'd')}</span>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!puedeSemanaSiguiente) return;
                              setSemanaVista((prev) => addWeeks(prev, 1));
                              setDiaSeleccionado(undefined);
                            }}
                            disabled={!puedeSemanaSiguiente}
                            className="p-1 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                            aria-label="Semana siguiente"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
        </div>
      )}

      {expandedId && (
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={() => toggleAccordion(expandedId)}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-2"
        >
          <ArrowLeft size={16} /> Volver a la lista
        </motion.button>
      )}

      <div className="space-y-4">
        {!expandedId && tareasRenderizadas.length > 0 && (
           <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-2">
               <span>Total en {filtroTipo === 'rango' ? 'el rango' : diaSeleccionado ? 'el día' : 'el mes'}: {tareasRenderizadas.length} actividades</span>
               {tipoVista !== 'mis_actividades' && tareasAgrupadas.length > 0 && (
                 <button
                   type="button"
                   onClick={toggleTodasOficinas}
                   className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                 >
                   {todasAbiertas ? 'Colapsar todas' : 'Expandir todas'}
                 </button>
               )}
           </div>
        )}

        {tareasRenderizadas.length === 0 ? (
           <div className="text-center py-16 px-4 bg-white/40 dark:bg-neutral-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-neutral-800 flex flex-col items-center justify-center shadow-xs">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                  <ClipboardList size={30} strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  No se encontraron actividades
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 max-w-sm mb-5">
                  No hay actividades para el período o filtro seleccionado. Puedes cambiar las fechas o registrar una nueva.
                </p>
                {(tipoVista === 'mis_actividades' ||
                  (tipoVista === 'gestion_jefe' && perfilUsuario.esJefe) ||
                  (tipoVista === 'gestion_rrhh' && perfilUsuario.esSupervisor)) && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
                  >
                    <Plus size={16} /> Crear Nueva Actividad
                  </button>
                )}
           </div>
        ) : expandedId ? (
           <AnimatePresence mode="wait">
             <motion.div
               key={expandedId}
               initial={{ opacity: 0, y: 16 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
               className="w-full grid grid-cols-1 gap-3"
             >
               {tareasRenderizadas.map((t: Tarea) => (
                   <TareaCard
                     key={t.id}
                     tarea={t}
                     isExpanded
                     onToggle={() => toggleAccordion(t.id)}
                     isJefe={perfilUsuario.esJefe} isRRHH={tipoVista === ('gestion_rrhh' as string)}
                     usuarioActual={perfilUsuario.id}
                     nombreUsuarioActual={perfilUsuario.nombre}
                     usuarios={usuarios}
                   />
               ))}
             </motion.div>
           </AnimatePresence>
        ) : (
           tareasAgrupadas.map((grupo: any) => {
               if (tipoVista === 'mis_actividades') {
                   return (
                       <div key={grupo.key} className="animate-in fade-in duration-500">
                           {grupo.titulo && (
                               <div className="flex items-center gap-3 mb-3 ml-1 mt-2">
                                   <div className="flex items-center gap-2 shrink-0">
                                       <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                           {grupo.titulo}
                                       </h3>
                                       <span className="bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                           {grupo.tareas.length}
                                       </span>
                                   </div>
                                   <div className="flex-1 h-px bg-slate-200 dark:bg-neutral-700" />
                               </div>
                           )}
                           <div className="grid grid-cols-1 gap-3">
                               {grupo.tareas.map((t: Tarea) => (
                                   <TareaCard key={t.id} tarea={t} isExpanded={false} onToggle={() => toggleAccordion(t.id)} isJefe={perfilUsuario.esJefe} isRRHH={tipoVista === ('gestion_rrhh' as string)} usuarioActual={perfilUsuario.id} nombreUsuarioActual={perfilUsuario.nombre} usuarios={usuarios} />
                               ))}
                           </div>
                       </div>
                   );
               } else {
                   const estaAbierta = oficinasAbiertas[grupo.key] || false;
                   const tieneSubgrupos = grupo.subgrupos && grupo.subgrupos.length > 0;
                   return (
                       <div key={grupo.key} className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
                           <div onClick={() => toggleOficina(grupo.key)} className="px-4 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
                               <div className="flex items-center gap-3 min-w-0">
                                   <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                                       <Building2 size={20} />
                                   </div>
                                   <div className="min-w-0">
                                       <h3 className="font-bold text-slate-800 dark:text-white text-sm">{grupo.titulo}</h3>
                                       <p className="text-xs text-slate-500 dark:text-gray-400">{grupo.tareas.length} actividades</p>
                                   </div>
                               </div>
                               <ChevronDown size={20} className={`text-slate-400 transition-transform shrink-0 ${estaAbierta ? 'rotate-180' : ''}`} />
                           </div>
                           
                           <AnimatePresence>
                               {estaAbierta && (
                                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50">
                                       {tieneSubgrupos ? (
                                         <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                                           {grupo.subgrupos.map((persona: { key: string; nombre: string; tareas: Tarea[] }) => (
                                             <div key={persona.key}>
                                               <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/80 dark:bg-neutral-800/40">
                                                 <User size={14} className="text-slate-400 shrink-0" />
                                                 <span className="text-xs font-bold text-slate-600 dark:text-gray-300 truncate">{persona.nombre}</span>
                                                 <span className="text-[10px] font-semibold bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-gray-300 px-2 py-0.5 rounded-full shrink-0">{persona.tareas.length}</span>
                                               </div>
                                               <div className="grid grid-cols-1 gap-2 py-2">
                                                 {persona.tareas.map((t: Tarea) => (
                                                   <TareaCard key={t.id} tarea={t} isExpanded={false} onToggle={() => toggleAccordion(t.id)} isJefe={perfilUsuario.esJefe} isRRHH={tipoVista === ('gestion_rrhh' as string)} usuarioActual={perfilUsuario.id} nombreUsuarioActual={perfilUsuario.nombre} usuarios={usuarios} />
                                                 ))}
                                               </div>
                                             </div>
                                           ))}
                                         </div>
                                       ) : (
                                         <div className="grid grid-cols-1 gap-2 py-2">
                                           {grupo.tareas.map((t: Tarea) => (
                                             <TareaCard key={t.id} tarea={t} isExpanded={false} onToggle={() => toggleAccordion(t.id)} isJefe={perfilUsuario.esJefe} isRRHH={tipoVista === ('gestion_rrhh' as string)} usuarioActual={perfilUsuario.id} nombreUsuarioActual={perfilUsuario.nombre} usuarios={usuarios} />
                                           ))}
                                         </div>
                                       )}
                                   </motion.div>
                               )}
                           </AnimatePresence>
                       </div>
                   );
               }
           })
        )}
      </div>

      {isModalOpen && <NewTarea isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} usuarios={usuarios} usuarioActual={perfilUsuario.id} esJefe={perfilUsuario.esJefe} />}
    </div>
  );
}
