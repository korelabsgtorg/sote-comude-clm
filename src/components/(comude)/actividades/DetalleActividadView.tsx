"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, ListTodo, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActComudeConParticipantes, ActComudeRegistro } from "./lib/zod";
import {
  useRegistrarAsistencia,
  useRegistrosAsistencia,
  useActualizarActa,
  useActualizarImagenesActividad,
  useActualizarEstadoSesion,
} from "./lib/hooks";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import DetalleUbicacionModal from "./modals/DetalleUbicacionModal";
import CrearComude from "./modals/CrearComude";
import JustificacionAsistenciaModal from "./modals/JustificacionAsistenciaModal";
import SustituirParticipanteModal from "./modals/SustituirParticipanteModal";
import EvidenciaVisorModal from "./modals/EvidenciaVisorModal";

import dynamic from "next/dynamic";
const ActaVisorModal = dynamic(() => import("./modals/ActaVisorModal"), { ssr: false });
const ComudePdfModal = dynamic(() => import("./modals/ComudePdfModal"), { ssr: false });

import TablaPuntosAgenda, { ContadoresEstado } from "./TablaPuntosAgenda";
import { useConfiguracionMunicipio } from "@/components/(base)/(settings)/municipio/hooks";
import { createClient } from "@/utils/supabase/client";
import { useEstructuraOrganizacional } from "@/components/(comude)/organizacion-jerarquica/organizacion-jerarquica/lib/hooks";
import { NodoOrganizacion } from "@/components/(comude)/organizacion-jerarquica/organizacion-jerarquica/lib/zod";

import { esHoy } from "./lib/dateUtils";
import ParticipanteRow from "./ParticipanteRow";
import DetalleActividadHeader from "./DetalleActividadHeader";
import DetalleActividadParticipantes from "./DetalleActividadParticipantes";
import DetalleActividadEvidencias from "./DetalleActividadEvidencias";

interface DetalleActividadViewProps {
  actividad: ActComudeConParticipantes | null;
  userId?: string | null;
  effectiveRole?: string;
  puedeGestionar: boolean;
  onClose?: () => void;
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

  // Filtro de estado para la tabla de agenda
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);

  const esFinalizada = actividad?.estado === "Finalizada";
  const esEncargado = !!(
    userId &&
    actividad?.act_comude_participantes?.some((p) => p.usuario_id === userId && p.encargado)
  );

  const puedeGestionarAgenda =
    effectiveRole === "super" || ((puedeGestionar || esEncargado) && !esFinalizada);

  const puedeGestionarFotos =
    effectiveRole === "super" || ((puedeGestionar || esEncargado) && !esFinalizada);

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

  // Estado para la sustitución de participantes
  const [isSustituirModalOpen, setIsSustituirModalOpen] = useState(false);
  const { data: estructuraOrg } = useEstructuraOrganizacional();

  const puedeSustituir = useMemo(() => {
    if (effectiveRole === "super") return true;
    if (!userId || !estructuraOrg) return false;

    let nodoUsuario: NodoOrganizacion | null = null;
    function buscarNodo(nodo: NodoOrganizacion) {
      if (nodo.tipo === "unidad" && nodo.titular_id === userId) {
        nodoUsuario = nodo;
        return;
      }
      for (const hijo of nodo.hijos || []) {
        buscarNodo(hijo);
        if (nodoUsuario) return;
      }
    }
    buscarNodo(estructuraOrg);

    if (!nodoUsuario) return false;

    let tieneSubordinados = false;
    function verificarSubordinados(nodo: NodoOrganizacion) {
      if (nodo.tipo === "unidad" && nodo.titular_id && nodo.titular_id !== userId) {
        tieneSubordinados = true;
        return;
      }
      for (const hijo of nodo.hijos || []) {
        verificarSubordinados(hijo);
        if (tieneSubordinados) return;
      }
    }

    for (const hijo of (nodoUsuario as NodoOrganizacion).hijos || []) {
      verificarSubordinados(hijo);
      if (tieneSubordinados) break;
    }

    return tieneSubordinados;
  }, [effectiveRole, userId, estructuraOrg]);

  const { mutateAsync: registrar } = useRegistrarAsistencia();
  const { data: registros = [] } = useRegistrosAsistencia(actividad?.id ?? null);
  const { mutateAsync: actualizarActa, isPending: isUploadingActa } = useActualizarActa();
  const { mutateAsync: actualizarImagenes, isPending: isUploadingImg } = useActualizarImagenesActividad();
  const { mutateAsync: actualizarEstado, isPending: isUpdatingEstado } = useActualizarEstadoSesion();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const getEstadoBotonLabel = () => {
    const estado = actividad?.estado;
    if (estado === "Programada" || !estado) return "Se apertura el COMUDE";
    if (estado === "En progreso") return "Finalizar COMUDE";
    if (estado === "Finalizada") return "COMUDE Finalizado";
    return null;
  };

  const getEstadoBotonStyle = () => {
    const estado = actividad?.estado;
    if (estado === "Programada" || !estado) return "bg-green-500 hover:bg-green-600 text-white cursor-pointer";
    if (estado === "En progreso") return "bg-blue-500 hover:bg-blue-600 text-white cursor-pointer";
    if (estado === "Finalizada")
      return "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-default shadow-none border border-zinc-300 dark:border-zinc-700";
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
      const fileExt = file.name.split(".").pop() || "pdf";
      const munId = actividad.municipio_id ?? "general";
      const filePath = `municipio_${munId}/sesion_${actividad.id}/acta/acta_${Date.now()}.${fileExt}`;

      // Si ya existía un acta previa, eliminar el archivo anterior del bucket
      const primerActa = actividad?.acta?.[0];
      if (primerActa && !primerActa.startsWith("http")) {
        await supabase.storage.from("actas").remove([primerActa]);
      }

      const { error: uploadError } = await supabase.storage.from("actas").upload(filePath, file);
      if (uploadError) throw uploadError;

      await actualizarActa({ id: actividad.id, actaUrl: filePath });
      toast.success("Acta cargada exitosamente");
    } catch {
      toast.error("Error al cargar el acta");
    }
    e.target.value = "";
  };

  const handleEliminarActa = async () => {
    const primerActa = actividad?.acta?.[0];
    if (!actividad || !primerActa) return;

    const result = await Swal.fire({
      title: "¿Eliminar Acta?",
      text: "El archivo se borrará permanentemente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        const supabase = createClient();
        let filePath = primerActa;
        if (filePath.startsWith("http")) {
          const parts = filePath.split("/");
          filePath = parts[parts.length - 1];
        }

        const { error: storageError } = await supabase.storage.from("actas").remove([filePath]);
        if (storageError) console.error("Error al borrar del bucket:", storageError);

        try {
          await actualizarActa({ id: actividad.id, actaUrl: null });
          toast.success("Acta eliminada correctamente.");
          setIsActaVisorOpen(false);
          setActaUrlToView(null);
        } catch {
          toast.error("Error al eliminar el acta.");
        }
      } catch {
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
      const { error: storageError } = await supabase.storage.from("portada_imagenes").remove([pathToRemove]);
      if (storageError) console.error("Error al borrar del bucket:", storageError);

      const currentImages = actividad.img || [];
      const newImages = currentImages.filter((p) => p !== pathToRemove);

      await actualizarImagenes({ id: actividad.id, imgPaths: newImages.length > 0 ? newImages : [] });
      toast.success("Imagen eliminada de la actividad.");
    } catch {
      toast.error("Error al quitar la imagen de la actividad.");
    }
  };

  const handleVerActa = async () => {
    if (!actividad || !actividad.acta || actividad.acta.length === 0) return;
    const filePath = actividad.acta[0];

    if (filePath.startsWith("http")) {
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
    } catch {
      toast.error("No se pudo obtener el archivo");
    } finally {
      setIsGenerandoUrl(false);
    }
  };

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
      toast.error(
        `Es muy temprano para marcar asistencia. Podrás hacerlo ${municipioSettings.minutos_antes_permitidos} minutos antes del inicio.`
      );
      return;
    }

    const esTarde = tipo === "entrada" && ahora > horaProgramada + minDespues;
    setIsRegistroTarde(esTarde);

    if (esTarde) {
      const fechaLimite = new Date(horaProgramada + minDespues);
      setHoraMostrar(fechaLimite.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } else {
      const fechaActividad = new Date(horaProgramada);
      setHoraMostrar(fechaActividad.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    setPendingTipoRegistro(tipo);
    setShowJustificationModal(true);
  };

  if (!mounted || !actividad) return null;

  const hoy = esHoy(actividad.fecha);
  const isMuyTemprano = municipioSettings
    ? Date.now() < new Date(actividad.fecha).getTime() - (municipioSettings.minutos_antes_permitidos ?? 0) * 60000
    : false;
  const participanteYo = actividad.act_comude_participantes.find((p) => p.usuario_id === userId);

  return (
    <>
      <div className="w-full flex flex-col flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-md">
        {/* Encabezado y Barra de Acciones */}
        <DetalleActividadHeader
          actividad={actividad}
          puedeGestionarAgenda={puedeGestionarAgenda}
          isUpdatingEstado={isUpdatingEstado}
          isUploadingActa={isUploadingActa}
          isGenerandoUrl={isGenerandoUrl}
          isCargandoPdfData={isCargandoPdfData}
          onClose={onClose}
          onActualizarEstado={handleActualizarEstado}
          onVerActa={handleVerActa}
          onCargarActa={handleCargarActa}
          onGeneratePdf={handleGeneratePdf}
          onAbrirNuevoPunto={() => setIsNuevoPuntoModalOpen(true)}
          estadoBotonLabel={getEstadoBotonLabel()}
          estadoBotonStyle={getEstadoBotonStyle()}
        />

        {/* Banner Superior: Mi Asistencia */}
        <div className="px-1.5 sm:px-6 py-3">
          {participanteYo ? (
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
                isFinalizada={esFinalizada}
                puedeSustituir={puedeSustituir}
                onSustituir={() => setIsSustituirModalOpen(true)}
                onVerMapa={() =>
                  setParticipanteMapa({
                    nombre: participanteYo.profiles?.nombre || "Sin nombre",
                    entrada:
                      registros.find(
                        (r) => r.usuario_id === participanteYo.usuario_id && r.tipo_registro === "entrada"
                      ) || null,
                    salida:
                      registros.find(
                        (r) => r.usuario_id === participanteYo.usuario_id && r.tipo_registro === "salida"
                      ) || null,
                  })
                }
              />
            </div>
          ) : (
            <div className="bg-[#fff8cc] dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm border border-[#ffe066] dark:border-yellow-700/50 p-2.5 rounded-sm flex items-center gap-2 font-medium">
              <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              La asistencia se podrá marcar {municipioSettings?.minutos_antes_permitidos ?? 15} mins. antes de iniciar
            </div>
          )}
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 border-b border-border/50 bg-muted/10">
          <div className="flex w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => setActiveTab("agenda")}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm cursor-pointer",
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
                "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm cursor-pointer",
                activeTab === "participantes"
                  ? "border-azul-trifinio text-azul-trifinio"
                  : "border-transparent text-muted-foreground dark:text-gray-300 hover:text-foreground dark:hover:text-white hover:bg-muted/30"
              )}
            >
              <Users className="w-4 h-4" />
              Participantes
            </button>
          </div>

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

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto pb-24 sm:pb-8">
          {activeTab === "agenda" && (
            <div className="px-1 sm:px-6 py-4">
              <TablaPuntosAgenda
                puntos={actividad.act_comude_puntos ?? []}
                actComudeId={actividad.id}
                municipioId={actividad.municipio_id}
                canManage={puedeGestionarAgenda}
                isAddModalOpen={isNuevoPuntoModalOpen}
                onCloseAddModal={() => setIsNuevoPuntoModalOpen(false)}
                sesionEstado={actividad.estado}
                filtroEstado={filtroEstado}
              />

              <DetalleActividadEvidencias
                actividadId={actividad.id}
                municipioId={actividad.municipio_id}
                imgPaths={actividad.img || []}
                puedeGestionarFotos={puedeGestionarFotos}
                isUploadingImg={isUploadingImg}
                onSelectEvidencia={(idx) => setEvidenciaSelectedIndex(idx)}
                onEliminarEvidencia={handleEliminarEvidencia}
                onSubirEvidencia={handleSubirEvidencia}
              />
            </div>
          )}

          {activeTab === "participantes" && (
            <DetalleActividadParticipantes
              actividad={actividad}
              registros={registros}
              userId={userId}
              hoy={hoy}
              canManageActive={canManageActive}
              onRegistrar={handleRegistrar}
              cargandoGPS={cargandoGPS}
              isMuyTemprano={isMuyTemprano}
              isPastDate={isPastDate}
              esFinalizada={esFinalizada}
              onVerMapa={(nombre, usuarioId) =>
                setParticipanteMapa({
                  nombre,
                  entrada: registros.find((r) => r.usuario_id === usuarioId && r.tipo_registro === "entrada") || null,
                  salida: registros.find((r) => r.usuario_id === usuarioId && r.tipo_registro === "salida") || null,
                })
              }
            />
          )}
        </div>
      </div>

      {/* Modales */}
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

      <SustituirParticipanteModal
        isOpen={isSustituirModalOpen}
        onClose={() => setIsSustituirModalOpen(false)}
        actComudeId={actividad.id}
        tituloActividad={actividad.detalles_sesion?.titulo || "Reunión de COMUDE"}
        userId={userId}
        effectiveRole={effectiveRole}
        participantesActuales={actividad.act_comude_participantes}
      />
    </>
  );
}
