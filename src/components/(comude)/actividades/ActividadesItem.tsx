"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronUp,
  Edit2,
  Trash2,
  ArrowRight,
  Download,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ActComudeConParticipantes } from "./lib/zod";
import { useEliminarActividad, useEmitirConvocatoria } from "./lib/hooks";
import { getComudeUrl } from "./lib/slug";
import Swal from "sweetalert2";
import CrearComude from "./modals/CrearComude";
import { getInitialGlobalMunicipioState } from "@/components/(base)/layout/actions";
import { createClient } from "@/utils/supabase/client";
import { domToPng } from "modern-screenshot";
import { toast } from "react-toastify";

const BUCKET = "portada_imagenes";

interface ActividadesItemProps {
  actividad: ActComudeConParticipantes;
  userId?: string | null;
  puedeGestionar: boolean;
  effectiveRole: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function formatFecha(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const diaName = dias[fecha.getDay()];
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString().slice(-2);
  let hours = fecha.getHours();
  const minutes = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${diaName} ${d}/${m}/${y} a las ${hours}:${minutes} ${ampm}`;
}

function esHoy(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

function formatFechaEmisionSpanish(municipioNombre: string, dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const meses = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
  ];
  const mun = (municipioNombre || "CONCEPCIÓN LAS MINAS").toUpperCase();
  const dia = date.getDate();
  const mes = meses[date.getMonth()];
  const anio = date.getFullYear();
  return `${mun} ${dia} DE ${mes} DE ${anio}.`;
}

function formatFechaReunionTexto(fechaStr?: string | null) {
  if (!fechaStr) {
    return {
      fechaTexto: "________",
      horaTexto: "a las diez de la mañana (10:00 A.M.)",
    };
  }
  const date = new Date(fechaStr);
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
  ];

  const diaNombre = dias[date.getDay()];
  const diaNum = date.getDate();
  const mesNombre = meses[date.getMonth()];
  const anioNum = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "P.M." : "A.M.";
  const formattedHours = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, "0");

  const horasPalabras: Record<number, string> = {
    1: "una", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
    6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
    11: "once", 12: "doce",
  };

  const minutosEnPalabras = (m: number): string => {
    if (m === 0) return "";
    if (m === 15) return " y quince minutos";
    if (m === 30) return " y media";
    if (m === 45) return " y cuarenta y cinco minutos";

    const unidades = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const decenas = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta"];
    const especiales: Record<number, string> = {
      10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
      16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
      20: "veinte", 21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
      25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve"
    };

    if (especiales[m]) return ` y ${especiales[m]} minutos`;
    const d = Math.floor(m / 10);
    const u = m % 10;
    if (u === 0) return ` y ${decenas[d]} minutos`;
    return ` y ${decenas[d]} y ${unidades[u]} minutos`;
  };

  let periodo = "";
  if (hours === 12 && minutes === 0) {
    periodo = "del mediodía";
  } else if (hours >= 12 && hours < 19) {
    periodo = "de la tarde";
  } else if (hours >= 19 || hours < 5) {
    periodo = "de la noche";
  } else {
    periodo = "de la mañana";
  }

  const horaEnTexto = `${formattedHours === 1 ? "la" : "las"} ${horasPalabras[formattedHours]}${minutosEnPalabras(minutes)} ${periodo}`;
  const horaDigital = `${formattedHours}:${minutesStr} ${ampm}`;

  return {
    fechaTexto: `${diaNombre} ${diaNum} de ${mesNombre} del año ${anioNum}`,
    horaTexto: `a ${horaEnTexto} (${horaDigital})`,
  };
}

interface ConvocatoriaConfigCached {
  municipioNombre: string;
  departamentoNombre: string;
  coordinadorNombre: string;
  coordinadorPuesto: string;
  destinatarios: string;
  logoIzqDataUri: string;
  logoDerDataUri: string;
  firmaDataUri: string;
  selloDataUri: string;
}

let globalConvocatoriaCache: ConvocatoriaConfigCached | null = null;
let cachePromise: Promise<ConvocatoriaConfigCached> | null = null;

async function getOrFetchConvocatoriaConfig(): Promise<ConvocatoriaConfigCached> {
  if (globalConvocatoriaCache) {
    return globalConvocatoriaCache;
  }
  if (cachePromise) {
    return cachePromise;
  }

  cachePromise = (async () => {
    const supabase = createClient();
    let munNombre = "CONCEPCIÓN LAS MINAS";
    let depNombre = "CHIQUIMULA";
    let coordNombre = "";
    let coordPuesto = "";
    let dest =
      "Síndicos Y Concejales\nRepresentantes De Los Consejos Comunitarios De Desarrollo De Primer Nivel\nRepresentantes De Las Entidades Públicas Con Presencia En El Municipio.\nApoyo de Oficinas con Presencia en la Municipalidad.";
    let izqUri = "";
    let derUri = "";
    let firUri = "";
    let selUri = "";

    try {
      const state = await getInitialGlobalMunicipioState();
      const munId = state.municipioId;

      if (munId) {
        const [munRes, configRes] = await Promise.all([
          supabase
            .from("lug_municipios")
            .select("nombre, departamento_id, lug_departamentos(nombre)")
            .eq("id", munId)
            .maybeSingle(),
          supabase
            .from("configuraciones_municipio")
            .select("convocatoria_config")
            .eq("municipio_id", munId)
            .maybeSingle(),
        ]);

        if (munRes.data) {
          if (munRes.data.nombre) munNombre = munRes.data.nombre;
          const dep = (munRes.data.lug_departamentos as any)?.nombre;
          if (dep) depNombre = dep;
        }

        const cfg = configRes.data?.convocatoria_config as any;
        if (cfg) {
          if (cfg.coordinador_nombre) coordNombre = cfg.coordinador_nombre;
          if (cfg.coordinador_puesto) coordPuesto = cfg.coordinador_puesto;
          if (cfg.destinatarios_default) dest = cfg.destinatarios_default;

          const fetchUri = async (path?: string) => {
            if (!path) return "";
            try {
              const { data, error } = await supabase.storage.from(BUCKET).download(path);
              if (error || !data) return "";
              return new Promise<string>((res) => {
                const reader = new FileReader();
                reader.onloadend = () => res((reader.result as string) || "");
                reader.onerror = () => res("");
                reader.readAsDataURL(data);
              });
            } catch {
              return "";
            }
          };

          const [izq, der, fir, sel] = await Promise.all([
            fetchUri(cfg.logo_izquierda_path),
            fetchUri(cfg.logo_derecha_path),
            fetchUri(cfg.firma_path),
            fetchUri(cfg.sello_path),
          ]);
          izqUri = izq;
          derUri = der;
          firUri = fir;
          selUri = sel;
        }
      }
    } catch (e) {
      console.error("Error pre-cargando configuración de convocatoria:", e);
    }

    const result: ConvocatoriaConfigCached = {
      municipioNombre: munNombre,
      departamentoNombre: depNombre,
      coordinadorNombre: coordNombre,
      coordinadorPuesto: coordPuesto,
      destinatarios: dest,
      logoIzqDataUri: izqUri,
      logoDerDataUri: derUri,
      firmaDataUri: firUri,
      selloDataUri: selUri,
    };

    globalConvocatoriaCache = result;
    return result;
  })();

  return cachePromise;
}

// ── Componente de Descarga Directa en Segundo Plano (Sin Modales) ─────────────
function ConvocatoriaDirectDownloader({
  actividad,
  isDownloading,
  onComplete,
}: {
  actividad: ActComudeConParticipantes;
  isDownloading: boolean;
  onComplete: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ConvocatoriaConfigCached | null>(globalConvocatoriaCache);
  const [readyToCapture, setReadyToCapture] = useState(false);

  useEffect(() => {
    if (!isDownloading) {
      setReadyToCapture(false);
      return;
    }

    let isMounted = true;

    const prepare = async () => {
      try {
        const config = await getOrFetchConvocatoriaConfig();
        if (isMounted) {
          setData(config);
          setReadyToCapture(true);
        }
      } catch (err) {
        console.error("Error al preparar descarga de convocatoria:", err);
        if (isMounted) onComplete();
      }
    };

    void prepare();

    return () => {
      isMounted = false;
    };
  }, [isDownloading, onComplete]);

  // Capturar DOM a PNG una vez que `readyToCapture` sea true
  useEffect(() => {
    if (!readyToCapture || !printRef.current || !data) return;

    let isMounted = true;

    const capture = async () => {
      try {
        // Pausa ultracorta para ciclo de pintado
        await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 50)));
        if (!isMounted || !printRef.current) return;

        const dataUrl = await domToPng(printRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
          quality: 0.95,
        });

        const actaStr = actividad.detalles_sesion?.acta ? `_Acta_${actividad.detalles_sesion.acta}` : "";
        const fileName = `Convocatoria_COMUDE${actaStr}.png`;

        const isMobileDevice =
          typeof navigator !== "undefined" &&
          (/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent)));

        // En dispositivos móviles (iPhone / Android), usar la hoja nativa para "Guardar Imagen" en Fotos / Archivos
        if (isMobileDevice && typeof navigator !== "undefined" && navigator.canShare) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: "image/png" });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Convocatoria COMUDE",
              text: `Convocatoria oficial COMUDE - Acta ${actividad.detalles_sesion?.acta || ""}`,
            });
            toast.success("Convocatoria lista.");
            return;
          }
        }

        // En PC / Escritorio, descarga directa al disco
        const link = document.createElement("a");
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Convocatoria descargada con éxito.");
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Error al generar imagen de la convocatoria:", err);
          toast.error("Hubo un error al generar la imagen de la convocatoria.");
        }
      } finally {
        if (isMounted) onComplete();
      }
    };

    void capture();

    return () => {
      isMounted = false;
    };
  }, [readyToCapture, data, actividad, onComplete]);

  const { fechaTexto, horaTexto } = formatFechaReunionTexto(actividad.fecha);
  const fechaEmisionStr = formatFechaEmisionSpanish(
    data?.municipioNombre || "CONCEPCIÓN LAS MINAS",
    actividad.convocatoria?.created_at
  );

  if (!isDownloading || !data) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "-9999px",
        zIndex: -9999,
        pointerEvents: "none",
      }}
    >
      <div
        ref={printRef}
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
        className="w-[750px] bg-white text-black p-12 flex flex-col justify-between text-[13.5px] leading-relaxed"
      >
        {/* Encabezado Superior (Logos + Título oficial) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo Izquierdo */}
            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              {data.logoIzqDataUri ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={data.logoIzqDataUri} alt="Logo Izquierdo" className="max-h-full max-w-full object-contain" />
              ) : null}
            </div>

            {/* Texto Central */}
            <div className="text-center flex-1 space-y-0.5">
              <h1 className="text-[15px] font-bold tracking-tight uppercase text-black">
                CONSEJO MUNICIPAL DE DESARROLLO –COMUDE–
              </h1>
              <p className="text-[12px] text-gray-800 font-normal">
                {data.municipioNombre}, {data.departamentoNombre}, Guatemala, C. A.
              </p>
            </div>

            {/* Logo Derecho */}
            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              {data.logoDerDataUri ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={data.logoDerDataUri} alt="Logo Derecho" className="max-h-full max-w-full object-contain" />
              ) : null}
            </div>
          </div>

          {/* Doble línea separadora */}
          <div className="border-t-2 border-b border-black h-1 my-2" />
        </div>

        {/* Cuerpo del Documento */}
        <div className="space-y-6 my-6">
          {/* Encabezado en negrita subrayado */}
          <div className="text-center">
            <p className="font-bold underline uppercase tracking-wide">
              CONSEJO MUNICIPAL DE DESARROLLO -COMUDE- {data.municipioNombre}, {data.departamentoNombre}.
            </p>
          </div>

          {/* Fecha de Emisión */}
          <div className="text-right font-bold tracking-wide">
            <p>{fechaEmisionStr}</p>
          </div>

          {/* Destinatarios */}
          <div className="space-y-1">
            <p className="font-bold">A:</p>
            <div className="font-normal pl-4 whitespace-pre-line leading-snug">
              {data.destinatarios}
            </div>
          </div>

          {/* Saludo */}
          <div className="pt-2">
            <p>Le saludo muy cordialmente deseándole toda clase de éxitos en sus labores diarias.</p>
          </div>

          {/* Párrafo de Convocatoria */}
          <div className="text-justify leading-relaxed">
            <p>
              Por este medio se les convoca a:{" "}
              <span className="font-bold">
                {actividad.detalles_sesion?.titulo || "Sesión Ordinaria de Consejo Municipal de Desarrollo -COMUDE-"}
              </span>{" "}
              para el día: <span className="font-bold">{fechaTexto}</span>, en el lugar:{" "}
              <span className="font-bold underline">
                {actividad.ubicacion || "GIMNASIO MUNICIPAL, Casco Urbano, " + data.municipioNombre}
              </span>
              , {horaTexto}.
            </p>
          </div>

          {/* Despedida */}
          <div className="pt-2">
            <p>Sin más que agregar me suscribo,</p>
          </div>
        </div>

        {/* Pie de página con Firma y Sello */}
        <div className="mt-28 space-y-6">
          <div className="flex justify-center relative w-full">
            <div className="relative text-center flex flex-col items-center">
              {/* Imagen de Firma ancha de extremo a extremo, anclada sobre el nombre */}
              {data.firmaDataUri && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-10 flex items-center justify-center"
                  style={{
                    bottom: "-45px",
                    width: "770px",
                    maxWidth: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.firmaDataUri}
                    alt="Firma"
                    style={{ width: "770px", maxWidth: "none", height: "auto", maxHeight: "350px" }}
                    className="object-contain mix-blend-multiply"
                  />
                </div>
              )}

              {/* Imagen de Sello Oficial a la derecha de la firma */}
              {data.selloDataUri && (
                <div
                  className="absolute pointer-events-none z-10 flex items-center justify-center"
                  style={{
                    bottom: "-10px",
                    left: "calc(50% + 4.6rem)",
                    width: "165px",
                    height: "165px",
                    maxWidth: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.selloDataUri}
                    alt="Sello Oficial"
                    style={{ width: "165px", height: "165px", maxWidth: "none" }}
                    className="object-contain mix-blend-multiply opacity-95"
                  />
                </div>
              )}

              {data.coordinadorNombre ? (
                <div className="pt-8 border-t border-transparent font-bold text-center z-0">
                  <p className="uppercase text-[14px]">{data.coordinadorNombre}</p>
                  {data.coordinadorPuesto && <p className="uppercase text-[13px]">{data.coordinadorPuesto}</p>}
                </div>
              ) : null}
            </div>
          </div>

          {/* Pie inferior con nombre de municipio */}
          <div className="pt-6 border-t border-gray-300 text-center font-serif text-[12px] italic text-gray-700">
            <p>{data.municipioNombre} {data.departamentoNombre}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActividadesItem({
  actividad,
  userId,
  puedeGestionar,
  effectiveRole,
  isExpanded,
  onToggle,
}: ActividadesItemProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDownloadingConvocatoria, setIsDownloadingConvocatoria] = useState(false);

  const { mutateAsync: eliminarActividad } = useEliminarActividad();
  const { mutateAsync: emitirConvocatoria, isPending: emitiendo } = useEmitirConvocatoria();

  const hoy = esHoy(actividad.fecha);
  const isPastDate = (() => {
    if (!actividad?.fecha) return false;
    const actDate = new Date(actividad.fecha);
    actDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return actDate < today;
  })();

  const convocatoriaEmitida = Boolean(
    actividad.convocatoria && (actividad.convocatoria.emitida || actividad.convocatoria.created_at)
  );

  // Pre-cargar en segundo plano la configuración y logos en caché de memoria para descarga instantánea
  useEffect(() => {
    if (convocatoriaEmitida) {
      void getOrFetchConvocatoriaConfig();
    }
  }, [convocatoriaEmitida]);

  const handleEliminar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "Eliminar Actividad",
      text: `Se eliminará permanentemente la actividad "${actividad.detalles_sesion?.titulo || "Sin título"}". Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarActividad(actividad.id);
        Swal.fire("¡Eliminado!", "La actividad ha sido eliminada.", "success");
      } catch (error) {
        Swal.fire("Error", "Hubo un problema al eliminar la actividad.", "error");
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditModalOpen(true);
  };

  // Crear / Emitir Convocatoria (Solo Admin)
  const handleCrearConvocatoria = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPastDate) {
      Swal.fire({
        title: "Fecha Vencida",
        text: "No es posible emitir una convocatoria para una reunión cuya fecha ya pasó. Por favor edita la actividad y actualiza la fecha a una vigente antes de emitir la convocatoria.",
        icon: "warning",
        confirmButtonColor: "#1a73e8",
        confirmButtonText: "Entendido",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Crear Convocatoria Oficial",
      text: `¿Desea emitir la Convocatoria Oficial para "${actividad.detalles_sesion?.titulo || "esta actividad"}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, Emitir Convocatoria",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await emitirConvocatoria(actividad.id);
        Swal.fire(
          "¡Convocatoria Emitida!",
          "La convocatoria ha sido emitida correctamente y se enviaron las notificaciones push.",
          "success"
        );
      } catch (error: any) {
        Swal.fire("Error", error.message || "No se pudo emitir la convocatoria.", "error");
      }
    }
  };

  // Descargar Convocatoria Oficial Directamente
  const handleDescargarConvocatoria = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloadingConvocatoria(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl border bg-white/70 dark:bg-white/5 backdrop-blur-sm shadow-sm overflow-hidden relative",
          hoy
            ? "border-azul-trifinio/40 ring-1 ring-azul-trifinio/20"
            : "border-white/30 dark:border-white/10"
        )}
      >
        {/* Línea azul lateral */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1a73e8]" />

        <div
          onClick={onToggle}
          className="w-full group flex flex-col cursor-pointer focus:outline-none"
        >
          {/* Cabecera Clickable */}
          <div className="flex items-center justify-between gap-3 p-4 pl-5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* Fila 1: Título */}
              <p className="text-[15px] font-bold text-foreground truncate">
                {actividad.detalles_sesion?.titulo || "Sin título"}
              </p>

              {/* Fila 2: Acta y Libro */}
              <p className="text-xs font-semibold text-foreground/80 uppercase">
                {actividad.detalles_sesion?.acta ? `ACTA ${actividad.detalles_sesion.acta}` : ""}
                {actividad.detalles_sesion?.acta && actividad.detalles_sesion?.libro ? ", " : ""}
                {actividad.detalles_sesion?.libro ? `LIBRO ${actividad.detalles_sesion.libro}` : ""}
                {!actividad.detalles_sesion?.acta && !actividad.detalles_sesion?.libro
                  ? "Sin acta/libro asignado"
                  : ""}
              </p>

              {/* Fila 3: Estado y Fecha */}
              <div className="flex flex-wrap items-center gap-x-1 text-xs sm:text-[13px]">
                <span
                  className={cn(
                    "font-bold",
                    actividad.estado === "Finalizada"
                      ? "text-gray-500 dark:text-gray-400"
                      : actividad.estado === "En progreso"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[#1a73e8] dark:text-blue-400"
                  )}
                >
                  {actividad.estado === "Finalizada"
                    ? "Finalizado,"
                    : actividad.estado === "En progreso"
                    ? "En progreso,"
                    : "En preparación,"}
                </span>
                <span className="text-muted-foreground font-medium capitalize">
                  {formatFecha(actividad.fecha)}
                </span>
              </div>
            </div>

            {/* Chevron de Expansión */}
            <div className="p-2 text-muted-foreground/50 group-hover:text-azul-trifinio transition-colors">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          </div>

          {/* Action Bar Expandible */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/50 bg-black/5 dark:bg-black/20 px-2.5 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-1 sm:gap-2">
                  {/* Izquierda: Eliminar y Editar (solo administradores / permisos de gestión) */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {effectiveRole === "super" && (
                      <button
                        onClick={handleEliminar}
                        className="flex items-center gap-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                        title="Eliminar Actividad"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </button>
                    )}

                    {puedeGestionar && (
                      <button
                        onClick={handleEdit}
                        className="flex items-center gap-1.5 text-sm font-semibold text-[#1a73e8] dark:text-blue-400 hover:bg-[#1a73e8]/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                      >
                        <Edit2 className="w-4 h-4 shrink-0" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  {/* Derecha: Crear/Descargar Convocatoria y Entrar */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {/* Botón de Convocatoria */}
                    {convocatoriaEmitida ? (
                      /* Descargar Convocatoria (Disponible para todos si ya fue emitida) */
                      <button
                        onClick={handleDescargarConvocatoria}
                        onMouseEnter={() => void getOrFetchConvocatoriaConfig()}
                        disabled={isDownloadingConvocatoria}
                        className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                        title="Descargar Convocatoria Oficial Directamente"
                      >
                        {isDownloadingConvocatoria ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Download className="w-4 h-4 shrink-0" />
                        )}
                        <span>Descargar</span>
                        <span className="hidden sm:inline">&nbsp;Convocatoria</span>
                      </button>
                    ) : (
                      /* Crear Convocatoria (Solo Admin cuando no ha sido emitida y la sesión NO está finalizada) */
                      puedeGestionar && actividad.estado !== "Finalizada" && (
                        <button
                          onClick={handleCrearConvocatoria}
                          disabled={emitiendo}
                          className={cn(
                            "flex items-center gap-1.5 text-sm font-semibold px-2 py-1 sm:px-3 sm:py-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap",
                            isPastDate
                              ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 opacity-75"
                              : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                          )}
                          title={
                            isPastDate
                              ? "La fecha del COMUDE ya venció. Edite la fecha para emitir la convocatoria."
                              : "Emitir Convocatoria Oficial para esta actividad"
                          }
                        >
                          {emitiendo ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          ) : (
                            <Send className="w-4 h-4 shrink-0" />
                          )}
                          <span>Crear</span>
                          <span className="hidden sm:inline">&nbsp;Convocatoria</span>
                        </button>
                      )
                    )}

                    <Link
                      href={getComudeUrl(actividad.id, actividad.detalles_sesion?.titulo)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-[15px] sm:text-base font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-md transition-colors shrink-0 whitespace-nowrap"
                    >
                      <span>Entrar</span>
                      <ArrowRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0 stroke-[2.5]" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Descarga en segundo plano sin modal */}
      {isDownloadingConvocatoria && (
        <ConvocatoriaDirectDownloader
          actividad={actividad}
          isDownloading={isDownloadingConvocatoria}
          onComplete={() => setIsDownloadingConvocatoria(false)}
        />
      )}

      {/* Modal Editar */}
      {isEditModalOpen && (
        <CrearComude
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          actorRole={effectiveRole}
          actividad={actividad}
        />
      )}
    </>
  );
}
