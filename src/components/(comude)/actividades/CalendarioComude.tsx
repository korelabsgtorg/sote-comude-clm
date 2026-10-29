"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Clock, 
  MapPin, 
  ArrowRight,
  Loader2,
  CalendarCheck,
  CalendarDays,
  ListTodo,
  FileText,
  Users2,
  Search,
  RotateCw,
  Eye,
  Calendar as CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useActividades, 
  useTodasActividadesComude, 
  useTodasActividadesComisiones 
} from "./lib/hooks";
import { 
  ActComudeConParticipantes, 
  ActividadComudeConContexto, 
  ActividadComisionConContexto 
} from "./lib/zod";
import { getComudeUrl } from "./lib/slug";
import { obtenerDatosGestor } from "@/components/(comude)/tareas/lib/actions";
import { type Tarea } from "@/components/(comude)/tareas/lib/zod";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";

interface CalendarioComudeProps {
  userId?: string | null;
  puedeGestionar: boolean;
  effectiveRole: string;
  onCrearClick?: () => void;
}

const DIAS_SEMANA = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

type CategoriaFiltro = "todos" | "comude" | "asig_comude" | "comision" | "personal" | "grupal";

interface EventoNormalizado {
  id: string;
  tipo: "comude" | "asig_comude" | "comision" | "personal" | "grupal";
  tipoEtiqueta: string;
  titulo: string;
  descripcion?: string | null;
  lugarOContexto?: string | null;
  fecha: string;
  dateStr: string;
  estado: string;
  url: string;
  urlTexto: string;
}

function formatHora12(isoStr: string) {
  try {
    const d = new Date(isoStr);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch {
    return "";
  }
}

function formatFechaCortaConDia(isoStr: string) {
  try {
    const d = new Date(isoStr);
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dia = dias[d.getDay()];
    const diaNum = String(d.getDate()).padStart(2, "0");
    const mesNum = String(d.getMonth() + 1).padStart(2, "0");
    const anioCorto = String(d.getFullYear()).slice(-2);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${dia} ${diaNum}/${mesNum}/${anioCorto}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return isoStr;
  }
}

function formatFechaLarga(fechaStr: string) {
  try {
    const [y, m, d] = fechaStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return `${dias[date.getDay()]} ${d} de ${MESES[date.getMonth()]} de ${y}`;
  } catch {
    return fechaStr;
  }
}

export default function CalendarioComude({
  userId,
  puedeGestionar,
  effectiveRole,
  onCrearClick,
}: CalendarioComudeProps) {
  const isSuperOrAdmin = puedeGestionar || isSuperOrAdminRole(effectiveRole);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaFiltro>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const ITEMS_POR_PAGINA = 5;

  // Popover selector de Mes/Año (según referencia imagen 2)
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [popoverYear, setPopoverYear] = useState(() => currentDate.getFullYear());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // 1. Sesiones COMUDE
  const { 
    data: actividades = [], 
    isLoading: cargandoSesiones,
    refetch: refetchSesiones 
  } = useActividades(currentYear, -1);

  // 2. Actividades Asignadas por el COMUDE
  const { 
    data: todasActividadesComude = [], 
    isLoading: cargandoActComude,
    refetch: refetchActComude 
  } = useTodasActividadesComude();

  // 3. Actividades vinculadas a Comisiones
  const { 
    data: todasActividadesComisiones = [], 
    isLoading: cargandoComisiones,
    refetch: refetchComisiones 
  } = useTodasActividadesComisiones(currentYear);

  // 4. Tareas del gestor (mis_actividades)
  const { 
    data: gestorData, 
    isLoading: cargandoTareas,
    refetch: refetchTareas 
  } = useQuery({
    queryKey: ["gestor-tareas", "mis_actividades"],
    queryFn: () => obtenerDatosGestor("mis_actividades"),
    staleTime: 1000 * 60 * 5,
  });

  const handleRefetchAll = () => {
    refetchSesiones();
    refetchActComude();
    refetchComisiones();
    refetchTareas();
  };

  const tareasCrudas = useMemo(() => {
    return (gestorData?.tareas || []) as Tarea[];
  }, [gestorData]);

  // Filtramos solo actividades estrictamente personales
  const tareasPersonalesPuras = useMemo(() => {
    const idsComude = new Set((todasActividadesComude || []).map((a) => a.id));
    const idsComision = new Set((todasActividadesComisiones || []).map((c) => c.id));
    return tareasCrudas.filter((t) => 
      !t.es_concejo && 
      !t.punto_id && 
      !t.comision_id && 
      !idsComude.has(t.id) && 
      !idsComision.has(t.id)
    );
  }, [tareasCrudas, todasActividadesComude, todasActividadesComisiones]);

  const misTareasIds = useMemo(() => {
    return new Set(tareasCrudas.map((t) => t.id));
  }, [tareasCrudas]);

  // ── Mapeo de Eventos Normalizados ──────────────────────────────────────
  const todosLosEventos = useMemo<EventoNormalizado[]>(() => {
    const lista: EventoNormalizado[] = [];

    // 1. Sesiones COMUDE
    actividades.forEach((s) => {
      if (!s.fecha) return;
      try {
        const d = new Date(s.fecha);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const lugar = (s.ubicacion || (s as any).lugar || "").trim();
        const subtitulo = s.detalles_sesion?.titulo || (lugar ? `Sesión • ${lugar}` : "Sesión de Consejo Municipal de Desarrollo");

        lista.push({
          id: s.id,
          tipo: "comude",
          tipoEtiqueta: "COMUDE",
          titulo: "Sesión COMUDE",
          descripcion: subtitulo,
          lugarOContexto: lugar || "COMUDE",
          fecha: s.fecha,
          dateStr,
          estado: s.estado || "En preparación",
          url: getComudeUrl(s.id, s.detalles_sesion?.titulo),
          urlTexto: "Ver sesión",
        });
      } catch {}
    });

    // 2. Actividades Asignadas por COMUDE
    todasActividadesComude.forEach((a) => {
      if (!a.fecha_limite) return;
      try {
        const pertenezcoAActComude = 
          misTareasIds.has(a.id) || 
          Boolean(userId && (a.encargado_id === userId || a.miembros?.some((m) => m.usuario_id === userId)));

        // Solo super y administrador pueden ver todas las actividades; otros roles solo ven las que les pertenecen
        if (!isSuperOrAdmin && !pertenezcoAActComude) return;

        const d = new Date(a.fecha_limite);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const subtitulo = a.punto_titulo ? `Punto: ${a.punto_titulo}` : (a.comude_titulo ? `COMUDE: ${a.comude_titulo}` : a.descripcion);

        lista.push({
          id: a.id,
          tipo: "asig_comude",
          tipoEtiqueta: "Actividad",
          titulo: a.titulo,
          descripcion: subtitulo,
          lugarOContexto: "COMUDE",
          fecha: a.fecha_limite,
          dateStr,
          estado: (a.estado || "no_iniciado").replace("_", " "),
          url: `/comude/actividades?origen=comude&id=${a.id}`,
          urlTexto: "Ver actividad COMUDE",
        });
      } catch {}
    });

    // 3. Actividades de Comisiones
    todasActividadesComisiones.forEach((c) => {
      if (!c.fecha_limite) return;
      try {
        const estoyInvolucrado = misTareasIds.has(c.id);

        // Solo super y administrador pueden ver todas las actividades; otros roles solo ven las que les pertenecen
        if (!isSuperOrAdmin && !estoyInvolucrado) return;

        const d = new Date(c.fecha_limite);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const subtitulo = c.comision_nombre ? `Comisión: ${c.comision_nombre}` : c.descripcion;
        const anio = d.getFullYear();

        const comisionBaseUrl = isSuperOrAdmin ? "/comude/comisiones/supervision" : "/comude/comisiones";
        const comisionUrl = c.comision_id
          ? `${comisionBaseUrl}?comisionId=${c.comision_id}&actividadId=${c.id}&año=${anio}`
          : `/comude/actividades?origen=comisiones&id=${c.id}`;

        lista.push({
          id: c.id,
          tipo: "comision",
          tipoEtiqueta: "Actividad",
          titulo: c.titulo,
          descripcion: subtitulo,
          lugarOContexto: "COMISION",
          fecha: c.fecha_limite,
          dateStr,
          estado: c.estado || "Asignado",
          url: comisionUrl,
          urlTexto: "Ver actividad",
        });
      } catch {}
    });

    // 4. Actividades Normales (Personales y Grupales)
    tareasPersonalesPuras.forEach((t) => {
      if (!t.due_date) return;
      try {
        const d = new Date(t.due_date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const esGrupal = Boolean(t.miembros && t.miembros.length > 0);
        const tipo = esGrupal ? "grupal" : "personal";
        const oficina = t.assignee?.oficina_nombre && t.assignee.oficina_nombre !== "Sin oficina" ? t.assignee.oficina_nombre : null;
        const subtitulo = oficina ? `Oficina: ${oficina}` : t.description;

        lista.push({
          id: t.id,
          tipo,
          tipoEtiqueta: "Actividad",
          titulo: t.title,
          descripcion: subtitulo,
          lugarOContexto: esGrupal ? "GRUPAL" : "PERSONAL",
          fecha: t.due_date,
          dateStr,
          estado: t.status || "Asignado",
          url: `/comude/actividades?origen=internas&id=${t.id}`,
          urlTexto: "Ir a actividades",
        });
      } catch {}
    });

    return lista.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [actividades, todasActividadesComude, todasActividadesComisiones, tareasPersonalesPuras, misTareasIds, isSuperOrAdmin, userId]);

  // Contadores para las píldoras superiores del mes actual
  const contadoresMes = useMemo(() => {
    let comude = 0;
    let asig_comude = 0;
    let comision = 0;
    let personal = 0;
    let grupal = 0;

    todosLosEventos.forEach((e) => {
      const d = new Date(e.fecha);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        if (e.tipo === "comude") comude++;
        else if (e.tipo === "asig_comude") asig_comude++;
        else if (e.tipo === "comision") comision++;
        else if (e.tipo === "personal") personal++;
        else if (e.tipo === "grupal") grupal++;
      }
    });

    return { comude, asig_comude, comision, personal, grupal };
  }, [todosLosEventos, currentYear, currentMonth]);

  // Eventos agrupados por dateStr para el calendario
  const eventosPorFechaMap = useMemo(() => {
    const map = new Map<string, EventoNormalizado[]>();
    todosLosEventos.forEach((e) => {
      const list = map.get(e.dateStr) || [];
      list.push(e);
      map.set(e.dateStr, list);
    });
    return map;
  }, [todosLosEventos]);

  // ── Matriz Mensual del Calendario ───────────────────────────────────────
  const celdasCalendario = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      eventos: EventoNormalizado[];
    }[] = [];

    // Mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(currentYear, currentMonth - 1, dayNum);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        eventos: eventosPorFechaMap.get(dateStr) || [],
      });
    }

    // Mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      cells.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        eventos: eventosPorFechaMap.get(dateStr) || [],
      });
    }

    // Mes siguiente (completar múltiplo de 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      cells.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        eventos: eventosPorFechaMap.get(dateStr) || [],
      });
    }

    return cells;
  }, [currentYear, currentMonth, eventosPorFechaMap]);

  // Filtrado de la tabla según día seleccionado, categoría y búsqueda
  const eventosFiltradosTabla = useMemo(() => {
    return todosLosEventos.filter((e) => {
      // 1. Filtro de fecha: Si hay un día seleccionado en el calendario, solo ese día
      if (selectedDateStr && e.dateStr !== selectedDateStr) {
        return false;
      }

      // Si no hay día seleccionado, mostrar únicamente los del mes activo
      if (!selectedDateStr) {
        const d = new Date(e.fecha);
        if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) {
          return false;
        }
      }

      // 2. Filtro de categoría
      if (filtroCategoria !== "todos" && e.tipo !== filtroCategoria) {
        return false;
      }

      // 3. Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitulo = e.titulo.toLowerCase().includes(q);
        const matchDesc = (e.descripcion || "").toLowerCase().includes(q);
        const matchLugar = (e.lugarOContexto || "").toLowerCase().includes(q);
        const matchEstado = e.estado.toLowerCase().includes(q);
        if (!matchTitulo && !matchDesc && !matchLugar && !matchEstado) return false;
      }

      return true;
    });
  }, [todosLosEventos, selectedDateStr, currentYear, currentMonth, filtroCategoria, searchQuery]);

  // Paginación
  const totalPaginas = Math.ceil(eventosFiltradosTabla.length / ITEMS_POR_PAGINA) || 1;
  const eventosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
    return eventosFiltradosTabla.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [eventosFiltradosTabla, paginaActual]);

  // Controles de mes
  const mesAnterior = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const mesSiguiente = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const irAHoy = () => {
    const hoy = new Date();
    setCurrentDate(hoy);
    setSelectedDateStr(
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
    );
    setPaginaActual(1);
  };
  const seleccionarMes = (mIndex: number) => {
    setCurrentDate(new Date(popoverYear, mIndex, 1));
    setIsMonthPickerOpen(false);
  };

  const isLoading = cargandoSesiones || cargandoActComude || cargandoComisiones || cargandoTareas;
  const numeroSemanas = Math.ceil(celdasCalendario.length / 7) || 5;

  return (
    <div className="space-y-4 w-full transition-all">
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA SUPERIOR: Filtros / Selector Mes / Búsqueda
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5 bg-white dark:bg-[#121316] px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-xs transition-colors">
        {/* Badges de Categorías (Píldoras compactas y minimalistas con scroll horizontal en móvil) */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1 sm:py-0 sm:flex-wrap">
          {/* Badge: COMUDE */}
          <button
            onClick={() => {
              setFiltroCategoria((prev) => (prev === "comude" ? "todos" : "comude"));
              setPaginaActual(1);
            }}
            className={cn(
              "h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer select-none shrink-0 whitespace-nowrap",
              filtroCategoria === "comude"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-blue-50/70 text-blue-700 border-blue-200/70 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40"
            )}
          >
            <span>COMUDE</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-[3px] text-[9.5px] font-mono leading-none",
              filtroCategoria === "comude" ? "bg-white/20 text-white" : "bg-blue-200/50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
            )}>
              {contadoresMes.comude}
            </span>
          </button>

          {/* Badge: Asig. COMUDE */}
          <button
            onClick={() => {
              setFiltroCategoria((prev) => (prev === "asig_comude" ? "todos" : "asig_comude"));
              setPaginaActual(1);
            }}
            className={cn(
              "h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer select-none shrink-0 whitespace-nowrap",
              filtroCategoria === "asig_comude"
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-purple-50/70 text-purple-700 border-purple-200/70 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/40"
            )}
          >
            <span>ASIG. COMUDE</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-[3px] text-[9.5px] font-mono leading-none",
              filtroCategoria === "asig_comude" ? "bg-white/20 text-white" : "bg-purple-200/50 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
            )}>
              {contadoresMes.asig_comude}
            </span>
          </button>

          {/* Badge: Comisión */}
          <button
            onClick={() => {
              setFiltroCategoria((prev) => (prev === "comision" ? "todos" : "comision"));
              setPaginaActual(1);
            }}
            className={cn(
              "h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer select-none shrink-0 whitespace-nowrap",
              filtroCategoria === "comision"
                ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                : "bg-amber-50/70 text-amber-700 border-amber-200/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40"
            )}
          >
            <span>COMISIÓN</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-[3px] text-[9.5px] font-mono leading-none",
              filtroCategoria === "comision" ? "bg-white/20 text-white" : "bg-amber-200/50 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
            )}>
              {contadoresMes.comision}
            </span>
          </button>

          {/* Badge: Personal */}
          <button
            onClick={() => {
              setFiltroCategoria((prev) => (prev === "personal" ? "todos" : "personal"));
              setPaginaActual(1);
            }}
            className={cn(
              "h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer select-none shrink-0 whitespace-nowrap",
              filtroCategoria === "personal"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-emerald-50/70 text-emerald-700 border-emerald-200/70 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40"
            )}
          >
            <span>PERSONAL</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-[3px] text-[9.5px] font-mono leading-none",
              filtroCategoria === "personal" ? "bg-white/20 text-white" : "bg-emerald-200/50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
            )}>
              {contadoresMes.personal}
            </span>
          </button>

          {/* Badge: Grupal */}
          <button
            onClick={() => {
              setFiltroCategoria((prev) => (prev === "grupal" ? "todos" : "grupal"));
              setPaginaActual(1);
            }}
            className={cn(
              "h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer select-none shrink-0 whitespace-nowrap",
              filtroCategoria === "grupal"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-indigo-50/70 text-indigo-700 border-indigo-200/70 hover:bg-indigo-100/70 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/40"
            )}
          >
            <span>GRUPAL</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-[3px] text-[9.5px] font-mono leading-none",
              filtroCategoria === "grupal" ? "bg-white/20 text-white" : "bg-indigo-200/50 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200"
            )}>
              {contadoresMes.grupal}
            </span>
          </button>

          {filtroCategoria !== "todos" && (
            <button
              onClick={() => {
                setFiltroCategoria("todos");
                setPaginaActual(1);
              }}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-white underline ml-1 cursor-pointer shrink-0 whitespace-nowrap"
            >
              Ver todos
            </button>
          )}
        </div>

        {/* Centro: Selector de Mes/Año interactivo */}
        <div className="flex items-center gap-1.5">
          <div className="relative z-30" ref={popoverRef}>
            <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-[#18191f] p-0.5 rounded-lg border border-slate-200 dark:border-neutral-800">
              <button
                onClick={mesAnterior}
                className="h-6.5 w-6.5 flex items-center justify-center rounded-md text-slate-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
                title="Mes anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setPopoverYear(currentYear);
                  setIsMonthPickerOpen(!isMonthPickerOpen);
                }}
                className="flex items-center gap-1.5 px-2.5 h-6.5 rounded-md text-xs font-semibold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <span>
                  {MESES[currentMonth]} {currentYear}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 transition-transform duration-200",
                    isMonthPickerOpen && "rotate-180"
                  )}
                />
              </button>

              <button
                onClick={mesSiguiente}
                className="h-6.5 w-6.5 flex items-center justify-center rounded-md text-slate-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
                title="Mes siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Popover del Selector de Mes (3 columnas x 4 filas) */}
            {isMonthPickerOpen && (
              <div className="absolute top-9 left-1/2 -translate-x-1/2 w-60 bg-white dark:bg-[#16171c] border border-slate-200 dark:border-neutral-800 shadow-xl rounded-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Selector de año del popover */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-neutral-800">
                  <button
                    onClick={() => setPopoverYear((y) => y - 1)}
                    className="p-1 rounded-md text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {popoverYear}
                  </span>
                  <button
                    onClick={() => setPopoverYear((y) => y + 1)}
                    className="p-1 rounded-md text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Matriz 3x4 de meses */}
                <div className="grid grid-cols-3 gap-1.5">
                  {MESES_CORTOS.map((mesCorto, idx) => {
                    const isCurrent =
                      idx === currentMonth && popoverYear === currentYear;
                    return (
                      <button
                        key={mesCorto}
                        onClick={() => seleccionarMes(idx)}
                        className={cn(
                          "py-1.5 px-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer",
                          isCurrent
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800/80"
                        )}
                      >
                        {mesCorto}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botón rápido Hoy */}
          <button
            onClick={irAHoy}
            className="h-7.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-100/80 dark:bg-[#18191f] text-slate-600 dark:text-neutral-300 hover:bg-slate-200/80 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer"
            title="Ir al mes y día actual"
          >
            Hoy
          </button>
        </div>

        {/* Derecha: Buscador y Refrescar */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar actividad..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full h-7.5 bg-slate-100/80 dark:bg-[#18191f] border border-slate-200 dark:border-neutral-800 rounded-lg pl-8 pr-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          <button
            onClick={handleRefetchAll}
            className="h-7.5 w-7.5 flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-100/80 dark:bg-[#18191f] text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
            title="Recargar actividades"
          >
            <RotateCw
              className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-blue-500")}
            />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CONTENIDO PRINCIPAL: Layout a Pantalla Completa
             Izquierda (~36%): Calendario Grid
             Derecha (~64%): Tabla Estructurada (estilo referencia)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch w-full">
        {/* ──────── COLUMNA IZQUIERDA: Cuadrícula del Calendario (~38%) ──────── */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121316] overflow-hidden shadow-sm transition-colors flex flex-col h-full">
          {/* Cabecera de días (LUN, MAR, MIÉ...) */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-[#16171b]">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="py-2.5 text-center text-[10px] font-bold tracking-wider text-slate-500 dark:text-neutral-400 border-r last:border-r-0 border-slate-200/80 dark:border-neutral-800/60"
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Celdas del Mes con filas distribuidas equitativamente para igualar la altura de la tabla */}
          <div
            className="grid grid-cols-7 gap-px bg-slate-200/90 dark:bg-neutral-800/60 flex-1"
            style={{ gridTemplateRows: `repeat(${numeroSemanas}, minmax(0, 1fr))` }}
          >
            {celdasCalendario.map((celda, idx) => {
              const countComude = celda.eventos.filter((e) => e.tipo === "comude").length;
              const totalOtrasActividades = celda.eventos.filter((e) => e.tipo !== "comude").length;
              const isSelected = selectedDateStr === celda.dateStr;

              return (
                <div
                  key={`${celda.dateStr}-${idx}`}
                  onClick={() => {
                    // Si se hace clic en el mismo día seleccionado, se deselecciona para ver todo el mes
                    setSelectedDateStr((prev) =>
                      prev === celda.dateStr ? null : celda.dateStr
                    );
                    setPaginaActual(1);
                  }}
                  className={cn(
                    "p-1 sm:p-1.5 min-h-[58px] h-full flex flex-col justify-between transition-all duration-150 cursor-pointer relative group select-none",
                    !celda.isCurrentMonth
                      ? "bg-slate-50/70 dark:bg-[#101114]/80 opacity-40 hover:opacity-75"
                      : "bg-white dark:bg-[#15161a] hover:bg-slate-50 dark:hover:bg-[#1c1d24]",
                    isSelected &&
                      "ring-2 ring-blue-500 ring-inset bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  )}
                >
                  {/* Número del día centrado en la parte superior */}
                  <div className="flex justify-center w-full">
                    <span
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold transition-all",
                        celda.isToday
                          ? "border border-blue-500 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/30"
                          : celda.isCurrentMonth
                          ? "text-slate-800 dark:text-neutral-200"
                          : "text-slate-400 dark:text-neutral-600"
                      )}
                    >
                      {celda.dayNumber}
                    </span>
                  </div>

                  {/* Etiquetas: COMUDE y Actividades generalizadas (Act {cantidad}) */}
                  <div className="flex flex-col gap-1 w-full mt-auto pb-0.5">
                    {countComude > 0 && (
                      <div className="w-full text-center py-0.5 px-0.5 sm:px-1 rounded-[3px] text-[8.5px] sm:text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70 shadow-xs tracking-tighter sm:tracking-normal leading-tight">
                        COMUDE
                      </div>
                    )}

                    {totalOtrasActividades > 0 && (
                      <div className="w-full text-center py-0.5 px-0.5 sm:px-1 rounded-[3px] text-[8.5px] sm:text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/70 shadow-xs tracking-tighter sm:tracking-normal leading-tight">
                        Act {totalOtrasActividades}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ──────── COLUMNA DERECHA: Tabla Estructurada (~62% según imagen 1) ──────── */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121316] overflow-hidden shadow-sm transition-colors flex flex-col h-full">
          {/* Encabezado superior de la tabla */}
          <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#15161b]">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                {selectedDateStr
                  ? `Actividades del ${formatFechaLarga(selectedDateStr)}`
                  : `Todas las actividades de ${MESES[currentMonth]} ${currentYear}`}
              </span>
            </div>

            {selectedDateStr && (
              <button
                onClick={() => {
                  setSelectedDateStr(null);
                  setPaginaActual(1);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
              >
                Ver todo el mes
              </button>
            )}
          </div>

          {/* Tabla de Actividades con scroll horizontal cómodo en móvil */}
          <div className="overflow-x-auto w-full flex-1 flex flex-col justify-between">
            <table className="w-full min-w-[620px] sm:min-w-full text-left border-collapse text-xs flex-1">
              <thead>
                <tr className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-[#16171b] text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-3 border-r border-slate-200/80 dark:border-neutral-800/60 whitespace-nowrap min-w-[90px]">CATEGORÍA</th>
                  <th className="py-3 px-3 border-r border-slate-200/80 dark:border-neutral-800/60 min-w-[240px] sm:min-w-[280px]">DESCRIPCIÓN</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200/80 dark:border-neutral-800/60 whitespace-nowrap min-w-[125px]">CONTEXTO / LUGAR</th>
                  <th className="py-3 px-3 border-r border-slate-200/80 dark:border-neutral-800/60 whitespace-nowrap min-w-[140px]">F. ACTIVIDAD</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[70px]">ACCIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/60">
                {eventosPaginados.length === 0 ? (
                  <>
                    <tr className="h-[54px] sm:h-[62px]">
                      <td colSpan={5} className="py-3 px-4 text-slate-400 dark:text-neutral-500 text-xs italic">
                        No hay actividades programadas para este criterio o fecha.
                      </td>
                    </tr>
                    {Array.from({ length: ITEMS_POR_PAGINA - 1 }).map((_, i) => (
                      <tr key={`empty-zero-${i}`} className="h-[54px] sm:h-[62px]">
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3">&nbsp;</td>
                      </tr>
                    ))}
                  </>
                ) : (
                  <>
                    {eventosPaginados.map((ev) => {
                      return (
                        <tr
                          key={`${ev.tipo}-${ev.id}`}
                          className="hover:bg-slate-50/70 dark:hover:bg-[#181920] transition-colors h-[54px] sm:h-[62px]"
                        >
                          {/* 1. CATEGORÍA */}
                          <td className="py-3 px-3 whitespace-nowrap border-r border-slate-100 dark:border-neutral-800/50">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-[4px] border inline-block",
                                ev.tipo === "comude" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                                ev.tipo === "asig_comude" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                                ev.tipo === "comision" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                                ev.tipo === "personal" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                                ev.tipo === "grupal" && "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                              )}
                            >
                              {ev.tipoEtiqueta}
                            </span>
                          </td>

                          {/* 2. DESCRIPCIÓN / TÍTULO */}
                          <td className="py-3 px-3 min-w-[240px] sm:min-w-[280px] max-w-[380px] border-r border-slate-100 dark:border-neutral-800/50">
                            <div className="font-semibold text-slate-800 dark:text-white line-clamp-2 leading-snug">
                              {ev.titulo}
                            </div>
                            {ev.descripcion && (
                              <div className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 leading-tight mt-0.5">
                                {ev.descripcion}
                              </div>
                            )}
                          </td>

                          {/* 3. CONTEXTO / LUGAR (Centrado) */}
                          <td className="py-3 px-3 text-center whitespace-nowrap border-r border-slate-100 dark:border-neutral-800/50">
                            {ev.tipo === "comude" ? (
                              <span
                                title={ev.lugarOContexto || undefined}
                                className="font-bold text-xs text-slate-800 dark:text-neutral-200 max-w-[180px] truncate inline-block align-middle"
                              >
                                {ev.lugarOContexto}
                              </span>
                            ) : (
                              <span
                                title={ev.lugarOContexto || undefined}
                                className={cn(
                                  "text-[10px] font-bold px-2.5 py-0.5 rounded-[4px] border inline-block tracking-wide uppercase max-w-[170px] truncate align-middle",
                                  ev.tipo === "asig_comude" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                                  ev.tipo === "comision" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                                  ev.tipo === "personal" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                                  ev.tipo === "grupal" && "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                                )}
                              >
                                {ev.lugarOContexto}
                              </span>
                            )}
                          </td>

                          {/* 4. FECHA Y HORA */}
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-neutral-300 font-medium border-r border-slate-100 dark:border-neutral-800/50">
                            {formatFechaCortaConDia(ev.fecha)}
                          </td>

                          {/* 5. ACCIÓN: Solo 'Ver' */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <Link
                              href={ev.url}
                              className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors shadow-xs"
                            >
                              <span>Ver</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Filas vacías adicionales para completar siempre 5 filas alineadas al calendario */}
                    {Array.from({ length: Math.max(0, ITEMS_POR_PAGINA - eventosPaginados.length) }).map((_, i) => (
                      <tr key={`empty-fill-${i}`} className="h-[54px] sm:h-[62px]">
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-neutral-800/50">&nbsp;</td>
                        <td className="py-3 px-3">&nbsp;</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pie de tabla con paginación (según referencia imagen 1: "1–X de X  < 1/1 >") */}
          <div className="p-3 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400 bg-slate-50/30 dark:bg-[#15161b] mt-auto">
            <span>
              {eventosFiltradosTabla.length === 0
                ? "0 de 0"
                : `${(paginaActual - 1) * ITEMS_POR_PAGINA + 1}–${Math.min(
                    paginaActual * ITEMS_POR_PAGINA,
                    eventosFiltradosTabla.length
                  )} de ${eventosFiltradosTabla.length}`}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                className="p-1 rounded-md border border-slate-200 dark:border-neutral-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-neutral-300">
                {paginaActual} / {totalPaginas}
              </span>
              <button
                onClick={() =>
                  setPaginaActual((p) => Math.min(p + 1, totalPaginas))
                }
                disabled={paginaActual === totalPaginas}
                className="p-1 rounded-md border border-slate-200 dark:border-neutral-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
