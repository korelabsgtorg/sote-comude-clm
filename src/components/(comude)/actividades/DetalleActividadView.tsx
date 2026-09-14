"use client";
import { domToJpeg } from 'modern-screenshot';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { useEffect, useState, useRef } from "react";
import { compressImageFile, isAllowedImageType, generateStoragePath } from "@/components/(uploads)/imgs/constants";
import Link from "next/link";
import {
  X,
  CalendarDays,
  Users,
  UserCheck,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Check,
  Loader2,
  Shield,
  Plus,
  Pencil,
  Trash2,
  ListTodo,
  Eye,
  Upload,
  ImagePlus,
  MoreVertical,
  Info,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActComudeConParticipantes, ActComudeRegistro } from "./lib/zod";
import { useRegistrarAsistencia, useRegistrosAsistencia, useActualizarAgenda, useEliminarActividad, useActualizarActa, useActualizarImagenesActividad, useSignedUrl, useActualizarEstadoSesion } from "./lib/hooks";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import DetalleUbicacionModal from "./modals/DetalleUbicacionModal";
import CrearComude from "./modals/CrearComude";
import JustificacionAsistenciaModal from "./modals/JustificacionAsistenciaModal";

import ImageUploader from "@/components/(uploads)/imgs/ImageUploader";
import { useStorageDisplayUrl } from "@/components/(uploads)/imgs/useStorageDisplayUrl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import dynamic from "next/dynamic";

const ActaVisorModal = dynamic(() => import("./modals/ActaVisorModal"), { ssr: false });
const ComudePdfModal = dynamic(() => import("./modals/ComudePdfModal"), { ssr: false });
import TablaPuntosAgenda, { ContadoresEstado } from "./TablaPuntosAgenda";
import { useConfiguracionMunicipio } from "@/components/(base)/(settings)/municipio/hooks";
import { createClient } from "@/utils/supabase/client";

function StorageImage({ path }: { path: string }) {
  const { data: url, isLoading } = useSignedUrl(path);

  if (isLoading) return <div className="w-full h-full bg-muted animate-pulse rounded-lg" />;
  if (!url) return <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground"><ImagePlus className="w-6 h-6 opacity-30" /></div>;
  return <img src={url} alt="Evidencia" className="w-full h-full object-contain rounded-lg transition-transform duration-500" />;
}

function EvidenciaVisorModal({
  isOpen,
  onClose,
  paths,
  initialIndex,
}: {
  isOpen: boolean;
  onClose: () => void;
  paths: string[];
  initialIndex: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setCurrentIndex(initialIndex);
  }, [isOpen, initialIndex]);

  const path = paths[currentIndex];
  const { data: url, isLoading } = useSignedUrl(isOpen ? path : null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="relative w-full h-[calc(100dvh-4rem)] sm:h-auto sm:max-h-[90dvh] sm:max-w-6xl flex flex-col bg-background rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
          <h3 className="text-foreground font-bold text-sm tracking-wider uppercase">Visor de Evidencia</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-black/5 min-h-0">
          {isLoading || !url ? (
            <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin" />
          ) : (
            <img src={url} alt="Evidencia ampliada" className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
          )}
        </div>

        {paths.length > 1 && (
          <div className="flex items-center justify-center gap-8 p-4 border-t border-border/50 bg-muted/30">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((i) => (i - 1 + paths.length) % paths.length);
              }}
              className="p-3 rounded-full bg-background border border-border/50 text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-muted-foreground tracking-widest">
              {currentIndex + 1} / {paths.length}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((i) => (i + 1) % paths.length);
              }}
              className="p-3 rounded-full bg-background border border-border/50 text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DetalleActividadViewProps {
  actividad: ActComudeConParticipantes | null;
  userId?: string | null;
  effectiveRole?: string;
  puedeGestionar: boolean;
  onClose?: () => void;
}

function formatFecha(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaName = dias[fecha.getDay()];
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString().slice(-2);
  let hours = fecha.getHours();
  const minutes = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${diaName} ${d}/${m}/${y} | ${hours}:${minutes} ${ampm}`;
}

function formatHora(isoStr: string) {
  const fecha = new Date(isoStr);
  let h = fecha.getHours();
  const m = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatFechaCompleta(fechaStr: string) {
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

function formatFechaCorto(isoStr: string) {
  const fecha = new Date(isoStr);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${meses[fecha.getMonth()]}, ${fecha.getFullYear()}`;
}

function calcDuracion(entrada: string, salida: string) {
  const diff = (new Date(salida).getTime() - new Date(entrada).getTime()) / 1000 / 60;
  if (diff < 0) return "--";
  const h = Math.floor(diff / 60);
  const m = Math.round(diff % 60);
  return `${h}h ${m}m`;
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

interface ParticipanteRowProps {
  participante: ActComudeConParticipantes["act_comude_participantes"][0];
  registros: ActComudeRegistro[];
  userId?: string | null;
  esActividadHoy: boolean;
  puedeGestionar: boolean;
  onRegistrar: (tipo: "entrada" | "salida") => void;
  onVerMapa: () => void;
  cargandoGPS: boolean;
  isMuyTemprano?: boolean;
  isPastDate: boolean;
}

function ParticipanteRow({
  participante,
  registros,
  userId,
  esActividadHoy,
  puedeGestionar,
  onRegistrar,
  onVerMapa,
  cargandoGPS,
  isMuyTemprano,
  isPastDate,
}: ParticipanteRowProps) {
  const regEntrada = registros.find(
    (r) => r.usuario_id === participante.usuario_id && r.tipo_registro === "entrada"
  );
  const regSalida = registros.find(
    (r) => r.usuario_id === participante.usuario_id && r.tipo_registro === "salida"
  );

  const esElUsuario = userId === participante.usuario_id;
  const confirmado = !!regEntrada;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1.5 sm:px-4 py-3 rounded-xl bg-muted/40",
      esElUsuario ? "border-2 border-azul-trifinio shadow-none" : "border border-border/40"
    )}>
      {/* Info de la persona */}
      <div className="flex items-start gap-3 min-w-0">

        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {participante.profiles?.nombre ?? "Sin nombre"}
          </p>
        </div>
      </div>

      {/* Tiempos de asistencia */}
      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 gap-2 sm:gap-6">
        <div className="flex justify-between sm:justify-center w-full sm:w-auto sm:gap-6 text-xs text-muted-foreground">
          {(!regEntrada && !regSalida) ? (
            <span className="text-muted-foreground dark:text-gray-400 italic sm:mr-4">Sin registros de asistencia</span>
          ) : (
            <>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5">
                <span className="font-semibold mb-0.5 sm:mb-0">Entrada:</span>
                <span className="font-mono text-[13px] font-medium text-foreground text-center">{regEntrada ? formatHora(regEntrada.created_at) : "--:--"}</span>
              </div>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5">
                <span className="font-semibold mb-0.5 sm:mb-0">Salida:</span>
                <span className="font-mono text-[13px] font-medium text-foreground text-center">{regSalida ? formatHora(regSalida.created_at) : "--:--"}</span>
              </div>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5 text-azul-trifinio">
                <span className="font-semibold mb-0.5 sm:mb-0">Duración:</span>
                <span className="font-mono text-[13px] font-medium text-center">
                  {regEntrada && regSalida ? calcDuracion(regEntrada.created_at, regSalida.created_at) : "--h --m"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Enlace de ubicación */}
        {(puedeGestionar || esElUsuario) && (regEntrada || regSalida) && (
          <button
            onClick={onVerMapa}
            title="Ver ubicación"
            className="text-azul-trifinio flex items-center justify-center bg-azul-trifinio/10 hover:bg-azul-trifinio/20 p-2.5 rounded-xl transition-colors ml-auto sm:ml-0 shrink-0"
          >
            <MapPin className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Botones para el propio usuario */}
      {esElUsuario && (!regEntrada || !regSalida) && !isPastDate && (
        <div className="w-full sm:w-auto shrink-0 flex justify-center mt-2 sm:mt-0">
          {!regEntrada ? (
            <button
              onClick={() => onRegistrar("entrada")}
              disabled={cargandoGPS || isMuyTemprano}
              className={`flex justify-center items-center gap-2 sm:gap-1.5 text-sm sm:text-xs font-semibold text-white px-4 py-4 sm:py-2 rounded-lg transition-colors w-full sm:w-auto ${
                isMuyTemprano
                  ? "bg-gray-400 dark:bg-neutral-600 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 disabled:opacity-60"
              }`}
            >
              {cargandoGPS ? <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin shrink-0" /> : <LogIn className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />}
              {cargandoGPS ? "Obteniendo ubicación..." : "Marcar Entrada"}
            </button>
          ) : (
            <button
              onClick={() => onRegistrar("salida")}
              disabled={cargandoGPS}
              className="flex justify-center items-center gap-2 sm:gap-1.5 text-sm sm:text-xs font-semibold bg-orange-600 text-white px-4 py-4 sm:py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors w-full sm:w-auto"
            >
              {cargandoGPS ? <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin shrink-0" /> : <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />}
              {cargandoGPS ? "Obteniendo ubicación..." : "Marcar Salida"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DetalleActividadView({
  actividad,
  userId,
  effectiveRole,
  puedeGestionar,
  onClose,
}: DetalleActividadViewProps) {
  const [mounted, setMounted] = useState(false);
  const [cargandoGPS, setCargandoGPS] = useState(false);
  const [nuevoPunto, setNuevoPunto] = useState("");
  const [editandoPuntoId, setEditandoPuntoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [participanteMapa, setParticipanteMapa] = useState<{
    nombre: string;
    entrada: ActComudeRegistro | null;
    salida: ActComudeRegistro | null;
  } | null>(null);
  
  const [evidenciaSelectedIndex, setEvidenciaSelectedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"agenda" | "participantes">("agenda");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isActaVisorOpen, setIsActaVisorOpen] = useState(false);
  const [actaUrlToView, setActaUrlToView] = useState<string | null>(null);
  
  // Nuevo Punto Modal
  const [isNuevoPuntoModalOpen, setIsNuevoPuntoModalOpen] = useState(false);
  const [isGenerandoUrl, setIsGenerandoUrl] = useState(false);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [evidenciaSignedUrls, setEvidenciaSignedUrls] = useState<string[]>([]);
  const [isCargandoPdfData, setIsCargandoPdfData] = useState(false);

  const handleGeneratePdf = async () => {
    setIsCargandoPdfData(true);
    try {
      const urls: string[] = [];
      if (actividad?.img && actividad.img.length > 0) {
        const supabase = createClient();
        for (const path of actividad.img) {
          if (path.startsWith("http")) {
            urls.push(path);
          } else {
            const { data } = await supabase.storage.from("portada_imagenes").createSignedUrl(path, 60 * 60);
            if (data?.signedUrl) urls.push(data.signedUrl);
          }
        }
      }
      setEvidenciaSignedUrls(urls);
      setIsPdfModalOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Error al preparar imágenes para el PDF");
      setIsPdfModalOpen(true);
    } finally {
      setIsCargandoPdfData(false);
    }
  };

  // Filtro de estado para la tabla de agenda
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const actaFileInputRef = useRef<HTMLInputElement>(null);
  
  const isOpen = !!actividad;
  
  const esFinalizada = actividad?.estado === "Finalizada";
  // Super usuario puede gestionar siempre; Admin solo si no está finalizada.
  const puedeGestionarAgenda = effectiveRole === "super" || (puedeGestionar && !esFinalizada);
  
  const puedeGestionarFotos = effectiveRole === "super" || (puedeGestionar && !esFinalizada);
  
  const isPastDate = (() => {
    if (!actividad?.fecha) return false;
    const actDate = new Date(actividad.fecha);
    actDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return actDate < today;
  })();

  const canManageActive = puedeGestionarAgenda && !isPastDate;
  
  // Estado para la justificación de asistencia tardía
  const { data: municipioSettings } = useConfiguracionMunicipio(actividad?.municipio_id);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [pendingTipoRegistro, setPendingTipoRegistro] = useState<"entrada" | "salida" | null>(null);
  const [isRegistroTarde, setIsRegistroTarde] = useState(false);
  const [horaMostrar, setHoraMostrar] = useState("");

  // Estado optimista para la agenda para respuesta inmediata
  const [optimisticAgenda, setOptimisticAgenda] = useState(actividad?.agenda || []);

  const { mutateAsync: registrar } = useRegistrarAsistencia();
  const { mutateAsync: eliminarActividad } = useEliminarActividad();
  const { data: registros = [] } = useRegistrosAsistencia(actividad?.id ?? null);
  const { mutateAsync: actualizarAgenda, isPending: isUpdatingAgenda } = useActualizarAgenda();
  const { mutateAsync: actualizarActa, isPending: isUploadingActa } = useActualizarActa();
  const { mutateAsync: actualizarImagenes, isPending: isUploadingImg } = useActualizarImagenesActividad();
  const { mutateAsync: actualizarEstado, isPending: isUpdatingEstado } = useActualizarEstadoSesion();

  // ── Helpers para el botón de estado de sesión ──────────────────────────────
  const getEstadoBotonLabel = () => {
    const estado = actividad?.estado;
    if (estado === "Programada" || !estado) return "Se apertura el COMUDE";
    if (estado === "En progreso") return "Finalizar COMUDE";
    if (estado === "Finalizada") {
      if (effectiveRole === "super") return "COMUDE Finalizado";
      return "COMUDE Finalizado"; // Show it as a status for everyone (we will handle clickability)
    }
    return null;
  };

  const getEstadoBotonStyle = () => {
    const estado = actividad?.estado;
    if (estado === "Programada" || !estado) return "bg-green-500 hover:bg-green-600 text-white cursor-pointer";
    if (estado === "En progreso") return "bg-blue-500 hover:bg-blue-600 text-white cursor-pointer";
    if (estado === "Finalizada") return "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-default shadow-none border border-zinc-300 dark:border-zinc-700";
    return "";
  };

  const handleActualizarEstado = async () => {
    if (!actividad) return;
    const estado = actividad.estado;
    if (estado === "Finalizada") return;

    let nuevoEstado: "Programada" | "En progreso" | "Finalizada" = "Programada";
    let mensajeHtml = "";

    if (estado === "Programada" || !estado) {
      nuevoEstado = "En progreso";
      mensajeHtml = `¿Está seguro de aperturar el COMUDE?<br/><br/><span style="font-size:0.9em;color:#666;">Se habilitará el registro de asistencia.</span>`;
    } else if (estado === "En progreso") {
      nuevoEstado = "Finalizada";
      mensajeHtml = `
        <div style="text-align: left;">
          <p>¿Está seguro de que deseas finalizar el COMUDE?</p>
          <br/>
          <p style="color: #c2410c; font-weight: bold; border: 1px solid #c2410c; padding: 10px; border-radius: 6px; font-size: 0.95em; text-align: justify;">
            ⚠️ ADVERTENCIA: Una vez finalizado, no será posible editar ni eliminar información del COMUDE, ni registrar nuevas asistencias.
          </p>
        </div>
      `;
    } else {
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: "Confirmar acción",
      html: mensajeHtml,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
    });

    if (isConfirmed) {
      try {
        await actualizarEstado({ actComudeId: actividad.id, nuevoEstado });
        if (nuevoEstado === "En progreso") {
          toast.success(estado === "Finalizada" ? "COMUDE reaperturado." : "COMUDE aperturado correctamente.");
        } else {
          toast.success("COMUDE finalizado correctamente.");
        }
      } catch {
        toast.error("Error al actualizar el estado del COMUDE.");
      }
    }
  };
  
  const handleCargarActa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actividad) return;
    
    if (file.type !== "application/pdf") {
      toast.error("Solo se permiten archivos PDF");
      return;
    }

    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop() || 'pdf';
      const filePath = `${actividad.id}/acta_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("actas").upload(filePath, file);
      if (uploadError) throw uploadError;

      await actualizarActa({ id: actividad.id, actaUrl: filePath });
      toast.success("Acta cargada exitosamente");
    } catch (err) {
      toast.error("Error al cargar el acta");
    }
    // reset input
    e.target.value = '';
  };

  const handleEliminarActa = async () => {
    const primerActa = actividad?.acta?.[0];
    if (!actividad || !primerActa) return;

    const result = await Swal.fire({
      title: '¿Eliminar Acta?',
      text: "El archivo se borrará permanentemente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const supabase = createClient();
        
        // Si no es una URL pública, extraer la ruta (como se guarda ahora)
        let filePath = primerActa;
        if (filePath.startsWith('http')) {
          const parts = filePath.split('/');
          filePath = parts[parts.length - 1]; // Extraer solo el nombre de archivo
        }

        // Eliminar del bucket
        const { error: storageError } = await supabase.storage.from("actas").remove([filePath]);
        if (storageError) console.error("Error al borrar del bucket:", storageError);
        
        // Actualizar la base de datos a null
        try {
          await actualizarActa({ id: actividad.id, actaUrl: null });
          toast.success("Acta eliminada correctamente.");
          setIsActaVisorOpen(false);
          setActaUrlToView(null);
        } catch (err: unknown) {
          toast.error("Error al eliminar el acta.");
        }
      } catch (err) {
        toast.error("Error al eliminar el acta");
      }
    }
  };

  const handleSubirEvidencia = async (newPath: string) => {
    if (!actividad) return;
    try {
      const currentImages = actividad.img || [];
      if (currentImages.length >= 4) {
        toast.error("Ya se han subido 4 imágenes.");
        return;
      }
      await actualizarImagenes({ id: actividad.id, imgPaths: [...currentImages, newPath] });
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleEliminarEvidencia = async (pathToRemove: string) => {
    if (!actividad) return;
    try {
      const supabase = createClient();
      
      // Borrar archivo del bucket
      const { error: storageError } = await supabase.storage.from("portada_imagenes").remove([pathToRemove]);
      if (storageError) console.error("Error al borrar del bucket:", storageError);

      const currentImages = actividad.img || [];
      const newImages = currentImages.filter(p => p !== pathToRemove);
      
      await actualizarImagenes({ id: actividad.id, imgPaths: newImages.length > 0 ? newImages : [] });
      toast.success("Imagen eliminada de la actividad.");
    } catch (err: unknown) {
      toast.error("Error al quitar la imagen de la actividad.");
    }
  };

  const handleReemplazarEvidencia = async (oldPath: string, newPath: string) => {
    if (!actividad) return;
    try {
      const currentImages = actividad.img || [];
      const newImages = currentImages.map(p => p === oldPath ? newPath : p);
      await actualizarImagenes({ id: actividad.id, imgPaths: newImages });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Error al actualizar la base de datos.");
    }
  };

  const handleVerActa = async () => {
    if (!actividad || !actividad.actas) return;
    
    // Si ya es una URL completa antigua, la usamos directo aunque falle
    if (actividad.actas.startsWith("http")) {
      setActaUrlToView(actividad.actas);
      setIsActaVisorOpen(true);
      return;
    }

    setIsGenerandoUrl(true);
    try {
      const supabase = createClient();
      // Firmar la URL por 1 hora (3600 segundos)
      const { data, error } = await supabase.storage.from("actas").createSignedUrl(actividad.actas, 3600);
      if (error || !data) throw new Error();
      
      setActaUrlToView(data.signedUrl);
      setIsActaVisorOpen(true);
    } catch (err) {
      toast.error("Error al obtener acceso al archivo. ¿Verificaste si el bucket es correcto?");
    } finally {
      setIsGenerandoUrl(false);
    }
  };

  useEffect(() => { setMounted(true); }, []);

  // Sincronizar agenda local con los props del servidor
  useEffect(() => {
    setOptimisticAgenda(actividad?.agenda || []);
  }, [actividad?.agenda]);

  const ejecutarRegistro = async (tipo: "entrada" | "salida", notas?: string) => {
    if (!userId || !actividad) return;
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización.");
      return;
    }
    setCargandoGPS(true);
    try {
      const posicion = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      await registrar({
        act_comude_id: actividad.id,
        tipo_registro: tipo,
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
        accuracy: posicion.coords.accuracy,
        notas,
      });
      toast.success(tipo === "entrada" ? "✅ Entrada registrada" : "👋 Salida registrada");
      setShowJustificationModal(false);
      setPendingTipoRegistro(null);
      
      if (tipo === "entrada") {
        setActiveTab("agenda");
      }
    } catch (err: unknown) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) toast.error("Se necesita permiso de ubicación.");
        else if (err.code === err.TIMEOUT) toast.error("No se pudo obtener la ubicación.");
        else toast.error("Error al obtener ubicación GPS.");
      } else {
        toast.error(err instanceof Error ? err.message : "Error al registrar asistencia.");
      }
    } finally {
      setCargandoGPS(false);
    }
  };

  const handleRegistrar = async (tipo: "entrada" | "salida") => {
    if (!actividad || !municipioSettings) return;
    
    const ahora = new Date().getTime();
    const horaProgramada = new Date(actividad.fecha).getTime();
    const minAntes = (municipioSettings.minutos_antes_permitidos ?? 0) * 60000;
    const minDespues = (municipioSettings.minutos_despues_permitidos ?? 0) * 60000;

    if (tipo === "entrada" && ahora < horaProgramada - minAntes) {
      toast.error(`Es muy temprano para marcar asistencia. Podrás hacerlo ${municipioSettings.minutos_antes_permitidos} minutos antes del inicio.`);
      return;
    }

    const esTarde = tipo === "entrada" && ahora > horaProgramada + minDespues;
    setIsRegistroTarde(esTarde);
    
    if (esTarde) {
      const fechaLimite = new Date(horaProgramada + minDespues);
      setHoraMostrar(fechaLimite.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      const fechaActividad = new Date(horaProgramada);
      setHoraMostrar(fechaActividad.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }

    setPendingTipoRegistro(tipo);
    setShowJustificationModal(true);
  };

  const handleToggleAgenda = async (itemId: string) => {
    if (!puedeGestionar || !actividad) return;
    
    // Optimistic Update
    const prevAgenda = optimisticAgenda;
    const nuevaAgenda = optimisticAgenda.map((item) =>
      item.id === itemId ? { ...item, completado: !item.completado } : item
    );
    setOptimisticAgenda(nuevaAgenda);

    try {
      await actualizarAgenda({ id: actividad.id, agenda: nuevaAgenda });
    } catch (error) {
      // Revert if error
      setOptimisticAgenda(prevAgenda);
      toast.error("Error al actualizar la agenda");
    }
  };

  const handleAgregarPunto = async () => {
    if (!nuevoPunto.trim() || !actividad || isUpdatingAgenda) return;
    const nuevo = { id: crypto.randomUUID(), titulo: nuevoPunto.trim(), completado: false };
    
    const prevAgenda = optimisticAgenda;
    const nuevaAgenda = [...optimisticAgenda, nuevo];
    setOptimisticAgenda(nuevaAgenda);
    setNuevoPunto("");

    try {
      await actualizarAgenda({ id: actividad.id, agenda: nuevaAgenda });
    } catch (error) {
      setOptimisticAgenda(prevAgenda);
      setNuevoPunto(nuevo.titulo);
      toast.error("Error al agregar el punto de agenda");
    }
  };

  const handleGuardarEdicion = async (itemId: string) => {
    if (!textoEdicion.trim() || !actividad || isUpdatingAgenda) return;
    
    const prevAgenda = optimisticAgenda;
    const nuevaAgenda = optimisticAgenda.map((item) =>
      item.id === itemId ? { ...item, titulo: textoEdicion.trim() } : item
    );
    setOptimisticAgenda(nuevaAgenda);
    setEditandoPuntoId(null);
    setTextoEdicion("");

    try {
      await actualizarAgenda({ id: actividad.id, agenda: nuevaAgenda });
    } catch (error) {
      setOptimisticAgenda(prevAgenda);
      toast.error("Error al editar el punto de agenda");
    }
  };

  const handleEliminarPunto = async (itemId: string) => {
    if (!actividad || isUpdatingAgenda) return;
    
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Se eliminará este punto de la agenda. ¡Esta acción no se puede deshacer!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const prevAgenda = optimisticAgenda;
      const nuevaAgenda = optimisticAgenda.filter((item) => item.id !== itemId);
      setOptimisticAgenda(nuevaAgenda);
      
      try {
        await actualizarAgenda({ id: actividad.id, agenda: nuevaAgenda });
        toast.success("Punto eliminado");
      } catch (error) {
        setOptimisticAgenda(prevAgenda);
        toast.error("Error al eliminar el punto de agenda");
      }
    }
  };

  const handleEliminarActividad = async () => {
    if (!actividad) return;

    const result = await Swal.fire({
      title: "Eliminar Actividad",
      text: `Se eliminará permanentemente la actividad "${actividad.detalles_sesion?.titulo || "Sin título"}". Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await eliminarActividad(actividad.id);
        toast.success("Actividad COMUDE eliminada");
        if (onClose) onClose();
      } catch (error) {
        toast.error("Error al eliminar la actividad");
      }
    }
  };



  if (!mounted || !actividad) return null;

  const hoy = esHoy(actividad.fecha);
  const isMuyTemprano = municipioSettings 
    ? Date.now() < new Date(actividad.fecha).getTime() - ((municipioSettings.minutos_antes_permitidos ?? 0) * 60000)
    : false;
  const encargados = actividad.act_comude_participantes.filter((p) => p.encargado && p.usuario_id !== userId);
  const integrantes = actividad.act_comude_participantes.filter((p) => !p.encargado && p.usuario_id !== userId);
  const participanteYo = actividad.act_comude_participantes.find((p) => p.usuario_id === userId);
  const regEntradaYo = registros.find((r) => r.usuario_id === userId && r.tipo_registro === "entrada");

  const content = (
    <div className="w-full flex flex-col flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-md">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-3 border-b border-border/50 border-dashed bg-muted/10 gap-3 sm:gap-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-azul-trifinio font-medium hover:underline text-sm w-fit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Volver
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Botón aperturar/finalizar COMUDE */}
          {puedeGestionarAgenda && (() => {
            const label = getEstadoBotonLabel();
            const style = getEstadoBotonStyle();
            if (!label || !style) return null;
            return (
              <button
                onClick={handleActualizarEstado}
                disabled={isUpdatingEstado}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2 ${style}`}
              >
                {isUpdatingEstado && <Loader2 className="w-4 h-4 animate-spin" />}
                {label}
              </button>
            );
          })()}

          {/* Ver Acta / Subir Acta */}
          {actividad.acta && actividad.acta.length > 0 ? (
            <button 
              onClick={async () => {
                const filePath = actividad.acta![0];
                if (filePath.startsWith('http')) {
                  setActaUrlToView(filePath);
                  setIsActaVisorOpen(true);
                  return;
                }
                setIsGenerandoUrl(true);
                try {
                  const supabase = createClient();
                  const { data, error } = await supabase.storage.from("actas").createSignedUrl(filePath, 60 * 60);
                  if (error) throw error;
                  if (data?.signedUrl) {
                    setActaUrlToView(data.signedUrl);
                    setIsActaVisorOpen(true);
                  }
                } catch (e) {
                  toast.error("No se pudo obtener el archivo");
                } finally {
                  setIsGenerandoUrl(false);
                }
              }}
              disabled={isGenerandoUrl}
              className="border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-transparent hover:bg-blue-600/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2"
            >
              {isGenerandoUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Ver Acta
            </button>
          ) : puedeGestionarAgenda ? (
            <button 
              onClick={() => actaFileInputRef.current?.click()}
              disabled={isUploadingActa}
              className="border border-zinc-700 text-zinc-700 dark:border-zinc-300 dark:text-zinc-200 bg-transparent hover:bg-zinc-500/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2"
            >
              {isUploadingActa ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Subir Acta
            </button>
          ) : null}

          <input 
            type="file" 
            ref={actaFileInputRef} 
            className="hidden" 
            accept="application/pdf" 
            onChange={handleCargarActa} 
          />

          {actividad.estado === "Finalizada" ? (
            <button 
              onClick={handleGeneratePdf} 
              disabled={isCargandoPdfData}
              className="border border-red-600 text-red-600 dark:text-red-400 dark:border-red-500 bg-transparent hover:bg-red-600/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2"
            >
              {isCargandoPdfData ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generar PDF
            </button>
          ) : puedeGestionarAgenda ? (
            <button 
              onClick={() => setIsNuevoPuntoModalOpen(true)}
              className="border border-purple-500 text-purple-600 dark:text-purple-400 dark:border-purple-400 bg-transparent hover:bg-purple-500/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2"
            >
              Nuevo Punto a tratar
            </button>
          ) : null}
        </div>
      </div>

      {/* Banner Superior: Mi Asistencia o Alerta */}
      <div className="px-3 sm:px-6 py-3">
        {participanteYo && (regEntradaYo || actividad.estado === "En progreso" || actividad.estado === "Finalizada") ? (
          <div>
            <p className="text-xs font-bold text-muted-foreground dark:text-gray-300 uppercase tracking-widest mb-2">
              Mi Asistencia
            </p>
            <ParticipanteRow
              participante={participanteYo}
              registros={registros}
              userId={userId}
              esActividadHoy={hoy}
              puedeGestionar={canManageActive}
              onRegistrar={handleRegistrar}
              cargandoGPS={cargandoGPS}
              isMuyTemprano={isMuyTemprano}
              isPastDate={isPastDate}
              onVerMapa={() => setParticipanteMapa({
                nombre: participanteYo.profiles?.nombre || "Sin nombre",
                entrada: registros.find(r => r.usuario_id === participanteYo.usuario_id && r.tipo_registro === "entrada") || null,
                salida: registros.find(r => r.usuario_id === participanteYo.usuario_id && r.tipo_registro === "salida") || null
              })}
            />
          </div>
        ) : (
          <div className="bg-[#fff8cc] dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm border border-[#ffe066] dark:border-yellow-700/50 p-2.5 rounded-sm flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            La asistencia se podrá marcar {municipioSettings?.minutos_antes_permitidos ?? 15} mins. antes de iniciar
          </div>
        )}
      </div>

      {/* Header Info */}
      <div className="px-3 sm:px-6 py-4 grid grid-cols-2 gap-4">
        {/* Col 1 */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Agenda COMUDE:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight">
              {actividad.detalles_sesion?.titulo || "Sin título"}
            </p>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Información:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] uppercase leading-tight">
              {actividad.detalles_sesion?.acta ? `ACTA ${actividad.detalles_sesion.acta}` : ""}
              {actividad.detalles_sesion?.acta && actividad.detalles_sesion?.libro ? ", " : ""}
              {actividad.detalles_sesion?.libro ? `LIBRO ${actividad.detalles_sesion.libro}` : ""}
              {!actividad.detalles_sesion?.acta && !actividad.detalles_sesion?.libro ? "Sin lugar definido" : ""}
            </p>
          </div>
        </div>

        {/* Col 2 */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Fecha:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight capitalize">
              {formatFechaCorto(actividad.fecha)}
            </p>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Hora:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight uppercase">
              {formatHora(actividad.fecha)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 border-b border-border/50 bg-muted/10">
        <div className="flex w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={() => setActiveTab("agenda")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm",
              activeTab === "agenda" 
                ? "border-azul-trifinio text-azul-trifinio" 
                : "border-transparent text-muted-foreground dark:text-gray-300 hover:text-foreground dark:hover:text-white hover:bg-muted/30"
            )}
          >
            <ListTodo className="w-4 h-4" />
            Agenda
          </button>
          <button
            onClick={() => setActiveTab("participantes")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm",
              activeTab === "participantes" 
                ? "border-azul-trifinio text-azul-trifinio" 
                : "border-transparent text-muted-foreground dark:text-gray-300 hover:text-foreground dark:hover:text-white hover:bg-muted/30"
            )}
          >
            <Users className="w-4 h-4" />
            Participantes
          </button>
        </div>
        
        {/* ContadoresEstado (solo se ven si estamos en la pestaña Agenda) */}
        {activeTab === "agenda" && (
          <div className="hidden sm:flex w-full sm:w-auto justify-center sm:justify-end border-t sm:border-t-0 border-border/50 sm:border-none py-2 sm:py-0">
            <ContadoresEstado 
              puntos={actividad.act_comude_puntos ?? []} 
              filtroEstado={filtroEstado}
              onFiltroChange={setFiltroEstado}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24 sm:pb-8">
        
        {activeTab === "agenda" && (
          <div className="px-1 sm:px-6 py-4">

            {/* Nueva tabla de puntos de agenda */}
            <TablaPuntosAgenda
              puntos={actividad.act_comude_puntos ?? []}
              actComudeId={actividad.id}
              canManage={puedeGestionarAgenda}
              isAddModalOpen={isNuevoPuntoModalOpen}
              onCloseAddModal={() => setIsNuevoPuntoModalOpen(false)}
              sesionEstado={actividad.estado}
              filtroEstado={filtroEstado}
            />


            {/* Evidencia / Fotos */}
            <div className="mt-8 border-t border-border/50 pt-6 pb-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Evidencia / Fotos
                </p>
                <span className="text-xs font-medium text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-md">
                  {(actividad.img?.length || 0)}/4
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {actividad.img?.map((path, idx) => (
                  <div key={idx} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border/50 shadow-sm">
                    <button 
                      onClick={() => setEvidenciaSelectedIndex(idx)}
                      className="absolute inset-0 w-full h-full cursor-pointer z-0"
                    >
                      <StorageImage path={path} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                    {puedeGestionarFotos && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminarEvidencia(path);
                        }}
                        className="absolute top-2 right-2 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer z-10"
                        title="Eliminar imagen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                
                {puedeGestionarFotos && (actividad.img?.length || 0) < 4 && (
                  <div className="relative aspect-[4/3]">
                    <ImageUploader
                      bucketName="portada_imagenes"
                      currentImagePath={null}
                      onUploadSuccess={handleSubirEvidencia}
                      onDeleteSuccess={() => {}}
                      disabled={isUploadingImg}
                      aspect={4/3}
                      aspectLabel="Horizontal 4:3"
                      maxSizeMB={0.2}
                      maxDimension={1920}
                      folderPath={`comudes/municipio_${actividad.municipio_id}/actividad_${actividad.id}`}
                      compact={true}
                      compactClassName="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-azul-trifinio/50 transition-colors"
                    />
                  </div>
                )}
              </div>
              
              {!puedeGestionarFotos && (!actividad.img || actividad.img.length === 0) && (
                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-lg">
                  <ImagePlus className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  No hay evidencia fotográfica disponible.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "participantes" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Encargados */}
          {encargados.length > 0 && (
            <div className="px-1 sm:px-6 py-4 border-b border-border/30">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-azul-trifinio" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Encargados
                </p>
              </div>
              <div className="space-y-2">
                {encargados.map((p) => (
                  <ParticipanteRow
                    key={p.usuario_id}
                    participante={p}
                    registros={registros}
                    userId={userId}
                    esActividadHoy={hoy}
                    puedeGestionar={canManageActive}
                    onRegistrar={handleRegistrar}
                    cargandoGPS={cargandoGPS}
                    onVerMapa={() => setParticipanteMapa({
                      nombre: p.profiles?.nombre || "Sin nombre",
                      entrada: registros.find(r => r.usuario_id === p.usuario_id && r.tipo_registro === "entrada") || null,
                      salida: registros.find(r => r.usuario_id === p.usuario_id && r.tipo_registro === "salida") || null
                    })}
                    isMuyTemprano={isMuyTemprano}
                    isPastDate={isPastDate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Integrantes */}
          {integrantes.length > 0 && (
            <div className="px-1 sm:px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Integrantes
                </p>
              </div>
              <div className="space-y-2">
                {integrantes.map((p) => (
                  <ParticipanteRow
                    key={p.usuario_id}
                    participante={p}
                    registros={registros}
                    userId={userId}
                    esActividadHoy={hoy}
                    puedeGestionar={canManageActive}
                    onRegistrar={handleRegistrar}
                    cargandoGPS={cargandoGPS}
                    onVerMapa={() => setParticipanteMapa({
                      nombre: p.profiles?.nombre || "Sin nombre",
                      entrada: registros.find(r => r.usuario_id === p.usuario_id && r.tipo_registro === "entrada") || null,
                      salida: registros.find(r => r.usuario_id === p.usuario_id && r.tipo_registro === "salida") || null
                    })}
                    isMuyTemprano={isMuyTemprano}
                    isPastDate={isPastDate}
                  />
                ))}
              </div>
            </div>
          )}

          {actividad.act_comude_participantes.length === 0 && (
            <div className="px-3 sm:px-6 py-10 text-center text-muted-foreground text-sm">
              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No hay miembros asignados a esta actividad.</p>
            </div>
          )}
          </div>
        )}
        </div>
      </div>
  );

  return (
    <>
      {content}
      {/* Modales extras */}
      <DetalleUbicacionModal
        isOpen={!!participanteMapa}
        onClose={() => setParticipanteMapa(null)}
        participanteNombre={participanteMapa?.nombre || ""}
        registroEntrada={participanteMapa?.entrada || null}
        registroSalida={participanteMapa?.salida || null}
      />

      {actaUrlToView && (
        <ActaVisorModal
          isOpen={isActaVisorOpen}
          onClose={() => {
            setIsActaVisorOpen(false);
            setActaUrlToView(null);
          }}
          actividadNombre={actividad.detalles_sesion?.titulo || "Sin título"}
          actaUrl={actaUrlToView}
          puedeGestionar={effectiveRole === "super" || effectiveRole === "admin"}
          onEliminar={handleEliminarActa}
        />
      )}

      {isEditModalOpen && effectiveRole && (
        <CrearComude
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          actorRole={effectiveRole}
          actividad={actividad}
        />
      )}

      {pendingTipoRegistro && (
        <JustificacionAsistenciaModal
          isOpen={showJustificationModal}
          onClose={() => {
            setShowJustificationModal(false);
            setPendingTipoRegistro(null);
          }}
          onConfirm={(justificacion) => ejecutarRegistro(pendingTipoRegistro, justificacion)}
          tipo={pendingTipoRegistro}
          horaMostrar={horaMostrar}
          isTarde={isRegistroTarde}
        />
      )}

      <EvidenciaVisorModal 
        isOpen={evidenciaSelectedIndex !== null}
        paths={actividad?.img || []}
        initialIndex={evidenciaSelectedIndex ?? 0}
        onClose={() => setEvidenciaSelectedIndex(null)}
      />

      <ComudePdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        actividad={actividad}
        registros={registros}
        evidenciaUrls={evidenciaSignedUrls}
      />
    </>
  );
}
