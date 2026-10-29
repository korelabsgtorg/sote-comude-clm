"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  FileText,
  Upload,
  Eye,
  Trash2,
  Loader2,
  ClipboardList,
  Plus,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Users,
  Building2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import {
  BUCKET_PLANES_TRABAJO,
  MAX_PLAN_TRABAJO_SIZE,
  extraerDatosArchivoPlan,
  formatFechaCorto,
  type MiComisionRecord,
} from "./lib/zod";
import { useGuardarPlanTrabajo, useEliminarPlanTrabajo } from "./lib/hooks";
import { useActividadesDeComision } from "../tareas/lib/hooks";
import TareaItem from "../tareas/TareaItem";
import NewTarea from "../tareas/modals/NewTarea";
import type { Usuario, Tarea } from "../tareas/lib/zod";

import { ActividadesSkeleton } from "./ComisionesSkeleton";

const PlanVisorModal = dynamic(
  () => import("./modals/PlanVisorModal"),
  { ssr: false },
);

interface Props {
  comision: MiComisionRecord;
  año: number;
  currentUserId?: string;
  compactHeader?: boolean;
  esSupervision?: boolean;
  onSeleccionarActividad?: (tareaId: string) => void;
}

export function ComisionList({
  comision,
  año,
  currentUserId,
  compactHeader = false,
  esSupervision = false,
  onSeleccionarActividad,
}: Props) {
  const { user, effectiveRole } = useUserContext();
  const usuarioActualId = user?.id || currentUserId || "";
  const esSuper = effectiveRole === "super";
  const esMiembro =
    !esSupervision ||
    Boolean(
      usuarioActualId &&
        comision.integrantes?.some((i) => i.id_integrante === usuarioActualId),
    );
  const puedeGestionar = esSuper || esMiembro;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerandoUrl, setIsGenerandoUrl] = useState(false);
  const [visorOpen, setVisorOpen] = useState(false);
  const [pdfUrlToView, setPdfUrlToView] = useState<string | null>(null);

  // Estado de Actividades de la Comisión
  const [isNewTareaOpen, setIsNewTareaOpen] = useState(false);
  const [expandedTareaId, setExpandedTareaId] = useState<string | null>(null);
  const [filtroOrigen, setFiltroOrigen] = useState<
    "asignadas" | "comude" | "vencidas" | null
  >(null);

  const { data: dataActividades, isLoading: loadingActividades } =
    useActividadesDeComision(comision.id, año);

  const tareasComision = dataActividades?.tareas ?? [];

  const esTareaVencida = (t: Tarea) => {
    return new Date() > new Date(t.due_date) && t.status !== "Completado";
  };

  const usuariosAsignables = useMemo<Usuario[]>(() => {
    if (dataActividades?.usuarios && dataActividades.usuarios.length > 0) {
      return dataActividades.usuarios;
    }
    return (comision.integrantes ?? []).map((int) => ({
      user_id: int.id_integrante,
      nombre: int.nombre || "Integrante",
      activo: true,
      esjefe: false,
      rol: int.rol,
      oficina_nombre: comision.nombre,
    }));
  }, [dataActividades?.usuarios, comision.integrantes, comision.nombre]);

  const nombreUsuarioActual = useMemo(() => {
    const enIntegrantes = comision.integrantes?.find(
      (i) => i.id_integrante === usuarioActualId,
    )?.nombre;
    if (enIntegrantes) return enIntegrantes;
    const enUsuarios = usuariosAsignables.find(
      (u) => u.user_id === usuarioActualId,
    )?.nombre;
    return (
      enUsuarios ||
      (user?.user_metadata?.nombre as string | undefined) ||
      "Usuario"
    );
  }, [comision.integrantes, usuariosAsignables, usuarioActualId, user]);

  const conteosActividades = useMemo(() => {
    const total = tareasComision.length;
    let asignadas = 0;
    let comude = 0;
    let vencidas = 0;

    for (const t of tareasComision) {
      if (esTareaVencida(t)) {
        vencidas++;
      } else if (t.es_concejo) {
        comude++;
      } else {
        asignadas++;
      }
    }

    return { total, asignadas, comude, vencidas };
  }, [tareasComision]);

  const tareasFiltradas = useMemo(() => {
    if (filtroOrigen === "vencidas") {
      return tareasComision.filter((t) => esTareaVencida(t));
    }
    if (filtroOrigen === "comude") {
      return tareasComision.filter(
        (t) => Boolean(t.es_concejo) && !esTareaVencida(t),
      );
    }
    if (filtroOrigen === "asignadas") {
      return tareasComision.filter((t) => !t.es_concejo && !esTareaVencida(t));
    }
    return tareasComision;
  }, [tareasComision, filtroOrigen]);

  const tareasRenderizadas = useMemo(() => {
    return expandedTareaId
      ? tareasFiltradas.filter((t) => t.id === expandedTareaId)
      : tareasFiltradas;
  }, [expandedTareaId, tareasFiltradas]);

  const guardarMutation = useGuardarPlanTrabajo(año);
  const eliminarMutation = useEliminarPlanTrabajo(año);

  const plan = comision.plan_trabajo;
  const datosArchivo = extraerDatosArchivoPlan(plan?.archivo_url);

  const handleSeleccionarArchivo = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!puedeGestionar) {
      toast.error(
        "Solo los integrantes de esta comisión o un superadministrador pueden cargar o actualizar el plan de trabajo.",
      );
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Solo se permiten archivos en formato PDF.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_PLAN_TRABAJO_SIZE) {
      toast.error("El archivo PDF no debe superar los 10 MB.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `municipio_${comision.municipio_id}/comision_${comision.id}/plan_${año}_${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_PLANES_TRABAJO)
        .upload(filePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const res = await guardarMutation.mutateAsync({
        idComision: comision.id,
        año,
        archivoPath: filePath,
        nombreArchivo: file.name,
      });

      if (!res.success) {
        await supabase.storage.from(BUCKET_PLANES_TRABAJO).remove([filePath]);
        toast.error(res.error ?? "No se pudo registrar el plan de trabajo.");
      } else {
        toast.success(
          plan
            ? "Plan de trabajo actualizado exitosamente."
            : "Plan de trabajo cargado exitosamente.",
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al subir el plan de trabajo.";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleVerPlan = async () => {
    if (!datosArchivo.path) {
      toast.error("No se encontró la ruta del archivo.");
      return;
    }

    if (datosArchivo.path.startsWith("http")) {
      setPdfUrlToView(datosArchivo.path);
      setVisorOpen(true);
      return;
    }

    setIsGenerandoUrl(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(BUCKET_PLANES_TRABAJO)
        .createSignedUrl(datosArchivo.path, 60 * 60);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("No se pudo generar el enlace del documento.");
      }

      setPdfUrlToView(data.signedUrl);
      setVisorOpen(true);
    } catch {
      toast.error("No se pudo abrir el archivo PDF.");
    } finally {
      setIsGenerandoUrl(false);
    }
  };

  const handleEliminarPlan = async () => {
    if (!plan) return;

    const isDark = document.documentElement.classList.contains("dark");
    const result = await Swal.fire({
      title: "¿Eliminar Plan de Trabajo?",
      text: `Se eliminará el plan de trabajo del año ${año} de esta comisión.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: isDark ? "#2c5f9b" : "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: isDark ? "#252526" : "#ffffff",
      color: isDark ? "#cccccc" : "#000000",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await eliminarMutation.mutateAsync({
        idComision: comision.id,
        año,
      });

      if (res.success) {
        toast.success("Plan de trabajo eliminado correctamente.");
        setVisorOpen(false);
        setPdfUrlToView(null);
      } else {
        toast.error(res.error ?? "No se pudo eliminar el plan.");
      }
    } catch {
      toast.error("Ocurrió un error al eliminar el plan de trabajo.");
    }
  };

  const fechaSubida = formatFechaCorto(plan?.created_at);

  return (
    <div className="space-y-3.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* DESCRIPCIÓN OPCIONAL (SI NO ESTÁ COMPACTA) */}
      {!compactHeader && comision.descripcion && (
        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border">
          <span className="font-semibold text-foreground">Propósito: </span>
          {comision.descripcion}
        </div>
      )}

      {/* TARJETA DEL PLAN DE TRABAJO ESTILO ARCHIVO ADJUNTO */}
      {plan ? (
        <div className="rounded-xl border border-border/60 bg-white dark:bg-neutral-900/80 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
                <FileText className="size-4.5" />
              </div>
              <div className="min-w-0 space-y-0.5 sm:space-y-0">
                <p className="text-xs sm:text-sm font-bold text-foreground break-words line-clamp-2 sm:line-clamp-1 leading-tight">
                  {datosArchivo.nombre}
                </p>
                {/* En PC se muestra alineado al lado del icono */}
                <p className="hidden sm:block text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
                  {fechaSubida && <span>{fechaSubida}</span>}
                  {fechaSubida && plan.subido_por_nombre && <span> · </span>}
                  {plan.subido_por_nombre && (
                    <span>Subido por: {plan.subido_por_nombre}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleVerPlan}
                disabled={isGenerandoUrl}
                className="size-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 cursor-pointer"
                title="Ver documento PDF"
              >
                {isGenerandoUrl ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>

              {puedeGestionar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleEliminarPlan}
                  disabled={eliminarMutation.isPending || isUploading}
                  className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  title="Eliminar plan de trabajo"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* En Móvil se muestra abajo del todo, iniciando desde debajo del icono para ganar todo el ancho */}
          <p className="sm:hidden text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
            {fechaSubida && <span>{fechaSubida}</span>}
            {fechaSubida && plan.subido_por_nombre && <span> · </span>}
            {plan.subido_por_nombre && (
              <span>Subido por: {plan.subido_por_nombre}</span>
            )}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 p-2.5 sm:px-3 sm:py-2.5 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-xs sm:text-sm">
                Plan de Trabajo {año}
              </p>
              <p className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400">
                Pendiente de entrega
              </p>
            </div>
          </div>

          {puedeGestionar && (
            <Button
              type="button"
              size="sm"
              onClick={handleSeleccionarArchivo}
              disabled={isUploading}
              className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs gap-1.5 font-semibold cursor-pointer border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              <span>Cargar PDF</span>
            </Button>
          )}
        </div>
      )}

      {/* SECCIÓN PRINCIPAL: ACTIVIDADES DE LA COMISIÓN */}
      <div className="rounded-xl border border-border/60 bg-background/40 dark:bg-neutral-900/40 px-1.5 py-2.5 sm:p-4 space-y-2.5 sm:space-y-3">
        {expandedTareaId ? (
          /* Vista enfocada / aislada: Volver a la lista idéntico a Actividades */
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => setExpandedTareaId(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-celeste-trifinio transition-colors cursor-pointer py-1"
            >
              <ArrowLeft className="size-4" />
              <span>Volver a la lista</span>
            </button>
          </div>
        ) : (
          /* Encabezado de Actividades */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-celeste-trifinio/15 text-celeste-trifinio">
                  <ClipboardList className="size-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Actividades
                </h4>
                <span className="inline-flex items-center justify-center rounded-full bg-muted/80 border border-border/40 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-muted-foreground">
                  {conteosActividades.total}
                </span>
              </div>

              {puedeGestionar && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsNewTareaOpen(true)}
                  className="sm:hidden h-6.5 px-2 text-[10.5px] gap-1 font-semibold cursor-pointer border border-celeste-trifinio/40 bg-celeste-trifinio/10 hover:bg-celeste-trifinio/20 text-celeste-trifinio dark:text-celeste-trifinio rounded-lg shrink-0 transition-colors"
                >
                  <Plus className="size-3" />
                  <span>Nueva Actividad</span>
                </Button>
              )}
            </div>

            <div className="flex items-center justify-center sm:justify-end gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
              {conteosActividades.total > 0 && (
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
                  {/* Asignadas */}
                  <button
                    type="button"
                    onClick={() =>
                      setFiltroOrigen((prev) =>
                        prev === "asignadas" ? null : "asignadas",
                      )
                    }
                    className={`flex h-7 items-center gap-1 sm:gap-1.5 rounded-lg border px-1.5 sm:px-2.5 text-[10.5px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      filtroOrigen === "asignadas"
                        ? "border-purple-500/60 bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold shadow-2xs ring-1 ring-purple-500/40"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300"
                    }`}
                    title={
                      filtroOrigen === "asignadas"
                        ? "Quitar filtro (mostrar todas)"
                        : "Filtrar actividades asignadas de la comisión"
                    }
                  >
                    <span>Asignadas</span>
                    <span className="inline-flex h-4 min-w-[15px] px-1 items-center justify-center rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold">
                      {conteosActividades.asignadas}
                    </span>
                  </button>

                  {/* COMUDE */}
                  <button
                    type="button"
                    onClick={() =>
                      setFiltroOrigen((prev) =>
                        prev === "comude" ? null : "comude",
                      )
                    }
                    className={`flex h-7 items-center gap-1 sm:gap-1.5 rounded-lg border px-1.5 sm:px-2.5 text-[10.5px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      filtroOrigen === "comude"
                        ? "border-blue-500/60 bg-blue-500/20 text-blue-600 dark:text-blue-300 font-bold shadow-2xs ring-1 ring-blue-500/40"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300"
                    }`}
                    title={
                      filtroOrigen === "comude"
                        ? "Quitar filtro (mostrar todas)"
                        : "Filtrar actividades asignadas por el COMUDE"
                    }
                  >
                    <span>COMUDE</span>
                    <span className="inline-flex h-4 min-w-[15px] px-1 items-center justify-center rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-300 text-[10px] font-bold">
                      {conteosActividades.comude}
                    </span>
                  </button>

                  {/* Vencidas */}
                  <button
                    type="button"
                    onClick={() =>
                      setFiltroOrigen((prev) =>
                        prev === "vencidas" ? null : "vencidas",
                      )
                    }
                    className={`flex h-7 items-center gap-1 sm:gap-1.5 rounded-lg border px-1.5 sm:px-2.5 text-[10.5px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      filtroOrigen === "vencidas"
                        ? "border-amber-500/60 bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold shadow-2xs ring-1 ring-amber-500/40"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300"
                    }`}
                    title={
                      filtroOrigen === "vencidas"
                        ? "Quitar filtro (mostrar todas)"
                        : "Filtrar actividades vencidas"
                    }
                  >
                    <span>Vencidas</span>
                    <span className="inline-flex h-4 min-w-[15px] px-1 items-center justify-center rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
                      {conteosActividades.vencidas}
                    </span>
                  </button>
                </div>
              )}

              {puedeGestionar && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsNewTareaOpen(true)}
                  className="hidden sm:inline-flex h-7.5 px-3 text-xs gap-1.5 font-semibold cursor-pointer border border-celeste-trifinio/40 bg-celeste-trifinio/10 hover:bg-celeste-trifinio/20 text-celeste-trifinio dark:text-celeste-trifinio rounded-lg shrink-0 transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>Nueva Actividad</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lista de Actividades */}
        {loadingActividades ? (
          <ActividadesSkeleton />
        ) : tareasRenderizadas.length > 0 ? (
          <div className="space-y-2.5">
            {tareasRenderizadas.map((tarea) => (
              <TareaItem
                key={tarea.id}
                tarea={tarea}
                isExpanded={expandedTareaId === tarea.id}
                onToggle={() => {
                  if (onSeleccionarActividad) {
                    onSeleccionarActividad(tarea.id);
                  } else {
                    setExpandedTareaId((prev) =>
                      prev === tarea.id ? null : tarea.id,
                    );
                  }
                }}
                isJefe={puedeGestionar}
                isRRHH={!puedeGestionar}
                usuarioActual={usuarioActualId}
                nombreUsuarioActual={nombreUsuarioActual}
                usuarios={usuariosAsignables}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 sm:p-6 text-center space-y-1.5">
            <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-celeste-trifinio/10 text-celeste-trifinio">
              <ClipboardList className="size-4.5" />
            </div>
            <h5 className="text-xs sm:text-sm font-bold text-foreground">
              {conteosActividades.total === 0
                ? "Sin actividades registradas"
                : filtroOrigen === "vencidas"
                  ? "Sin actividades vencidas"
                  : filtroOrigen === "comude"
                    ? "Sin actividades del COMUDE"
                    : filtroOrigen === "asignadas"
                      ? "Sin actividades asignadas"
                      : "Sin actividades"}
            </h5>
            <p className="text-[11px] sm:text-xs text-muted-foreground max-w-md mx-auto">
              {conteosActividades.total === 0
                ? puedeGestionar
                  ? "Crea una nueva actividad para organizar el trabajo colaborativo entre los integrantes de esta comisión."
                  : "Esta comisión aún no cuenta con actividades registradas para este período."
                : filtroOrigen === "vencidas"
                  ? "¡Excelente! Todas las actividades están al día o han sido completadas."
                  : filtroOrigen === "comude"
                    ? "Esta comisión aún no tiene actividades asignadas desde las sesiones del COMUDE."
                    : filtroOrigen === "asignadas"
                      ? "No hay actividades registradas internamente en esta comisión."
                      : "No hay actividades que coincidan con el filtro seleccionado."}
            </p>
          </div>
        )}
      </div>

      {/* MODAL NUEVA ACTIVIDAD DE COMISIÓN */}
      {puedeGestionar && (
        <NewTarea
          isOpen={isNewTareaOpen}
          onClose={() => setIsNewTareaOpen(false)}
          usuarios={usuariosAsignables}
          usuarioActual={usuarioActualId}
          esJefe={puedeGestionar}
          comisionId={comision.id}
        />
      )}

      {/* MODAL VISOR */}
      {pdfUrlToView && (
        <PlanVisorModal
          isOpen={visorOpen}
          onClose={() => {
            setVisorOpen(false);
            setPdfUrlToView(null);
          }}
          planUrl={pdfUrlToView}
          comisionNombre={comision.nombre}
          año={año}
        />
      )}
    </div>
  );
}
