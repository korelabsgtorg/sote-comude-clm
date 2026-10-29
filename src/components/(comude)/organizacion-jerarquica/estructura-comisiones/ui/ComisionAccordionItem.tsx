"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  UserPlus,
  Trash2,
  Pencil,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Loader2,
  Clock,
  Crown,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import {
  BUCKET_PLANES_TRABAJO,
  extraerDatosArchivoPlan,
  type ComisionRecord,
  type ComisionIntegranteRecord,
  type PlanTrabajoRecord,
} from "../lib/zod";
import {
  useEliminarIntegrante,
  useAlternarEstadoComision,
  useCambiarCoordinadorComision,
} from "../lib/hooks";
import { toast } from "react-toastify";

const PlanVisorModal = dynamic(
  () => import("@/components/(comude)/comisiones/modals/PlanVisorModal"),
  { ssr: false },
);

interface Props {
  comision: ComisionRecord;
  integrantes: ComisionIntegranteRecord[];
  planTrabajo?: PlanTrabajoRecord | null;
  año: number;
  onEditar: (comision: ComisionRecord) => void;
  onAsignar: (comision: ComisionRecord) => void;
  defaultExpanded?: boolean;
}

const ACCORDION_EASE = [0.33, 1, 0.68, 1] as const;

export function ComisionAccordionItem({
  comision,
  integrantes,
  planTrabajo = null,
  año,
  onEditar,
  onAsignar,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [visorOpen, setVisorOpen] = useState(false);
  const [pdfUrlToView, setPdfUrlToView] = useState<string | null>(null);
  const [isGenerandoUrl, setIsGenerandoUrl] = useState(false);

  const eliminarMutation = useEliminarIntegrante(año);
  const alternarEstadoMutation = useAlternarEstadoComision();
  const cambiarCoordinadorMutation = useCambiarCoordinadorComision(año);

  const { user, effectiveRole } = useUserContext();
  const puedeGestionarCoordinador = isSuperOrAdminRole(
    effectiveRole || (user?.user_metadata?.rol as string) || user?.role || ""
  );

  const integrantesOrdenados = useMemo(() => {
    return [...integrantes].sort((a, b) => {
      if (a.es_coordinador && !b.es_coordinador) return -1;
      if (!a.es_coordinador && b.es_coordinador) return 1;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });
  }, [integrantes]);

  const handleToggleCoordinador = async (int: ComisionIntegranteRecord) => {
    if (!puedeGestionarCoordinador) {
      toast.warn("Solo administradores y superusuarios pueden designar coordinadores.");
      return;
    }

    if (int.es_coordinador) {
      toast.info(
        "La comisión no puede quedarse sin coordinador. Para cambiarlo, designa a otro integrante como nuevo coordinador."
      );
      return;
    }

    const coordinadorActual = integrantes.find((i) => i.es_coordinador);

    if (coordinadorActual) {
      const res = await Swal.fire({
        title: "¿Transferir coordinación?",
        html: `¿Deseas nombrar a <b class="text-blue-500">${int.nombre}</b> como nuevo coordinador?<br/><span class="text-xs text-muted-foreground block mt-2"><b>${coordinadorActual.nombre}</b> dejará de ser el coordinador de esta comisión.</span>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, transferir",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#0066cc",
        cancelButtonColor: "#6b7280",
      });

      if (res.isConfirmed) {
        try {
          const result = await cambiarCoordinadorMutation.mutateAsync({
            comisionId: comision.id,
            año,
            nuevoCoordinadorIntegranteId: int.id_integrante,
          });
          if (result.success) {
            toast.success(`${int.nombre} ahora es el coordinador.`);
          } else {
            toast.error(result.error ?? "No se pudo actualizar el coordinador.");
          }
        } catch {
          toast.error("Ocurrió un error al cambiar de coordinador.");
        }
      }
    } else {
      const res = await Swal.fire({
        title: "¿Designar coordinador?",
        html: `¿Deseas nombrar a <b class="text-blue-500">${int.nombre}</b> como coordinador de esta comisión?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, designar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#0066cc",
        cancelButtonColor: "#6b7280",
      });

      if (res.isConfirmed) {
        try {
          const result = await cambiarCoordinadorMutation.mutateAsync({
            comisionId: comision.id,
            año,
            nuevoCoordinadorIntegranteId: int.id_integrante,
          });
          if (result.success) {
            toast.success(`${int.nombre} ahora es el coordinador.`);
          } else {
            toast.error(result.error ?? "No se pudo designar el coordinador.");
          }
        } catch {
          toast.error("Ocurrió un error al designar el coordinador.");
        }
      }
    }
  };

  const datosArchivo = extraerDatosArchivoPlan(planTrabajo?.archivo_url);

  const handleVerPlan = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!datosArchivo.path) {
      toast.error("No se encontró el archivo del plan de trabajo.");
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
        throw error ?? new Error("No se pudo abrir el documento.");
      }

      setPdfUrlToView(data.signedUrl);
      setVisorOpen(true);
    } catch {
      toast.error("No se pudo obtener el PDF del plan de trabajo.");
    } finally {
      setIsGenerandoUrl(false);
    }
  };

  const handleEliminarIntegrante = async (
    e: React.MouseEvent,
    idAsignacion: string,
    nombre: string,
    esCoordinador?: boolean,
  ) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: "¿Remover integrante?",
      html: `¿Deseas remover a <b class="text-blue-500">${nombre}</b> de esta comisión en el año <b>${año}</b>?${
        esCoordinador
          ? `<br/><span class="text-xs text-amber-500 font-semibold block mt-2">⚠️ Este integrante es el actual coordinador de la comisión.</span>`
          : ""
      }`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await eliminarMutation.mutateAsync(idAsignacion);
      if (res.success) {
        toast.success("Integrante removido de la comisión.");
      } else {
        toast.error(res.error ?? "No se pudo remover el integrante.");
      }
    } catch {
      toast.error("Ocurrió un error al remover.");
    }
  };

  const handleToggleActivo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await alternarEstadoMutation.mutateAsync({
        id: comision.id,
        nuevoEstado: !comision.activo,
      });
      if (res.success) {
        toast.success(
          comision.activo ? "Comisión desactivada." : "Comisión activada.",
        );
      } else {
        toast.error(res.error ?? "Error al cambiar estado.");
      }
    } catch {
      toast.error("Error al modificar estado.");
    }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border transition-all shadow-sm overflow-hidden",
          comision.activo
            ? "border-border/60 bg-card hover:border-celeste-trifinio/40"
            : "border-dashed border-muted-foreground/30 bg-muted/30 opacity-80",
        )}
      >
        <div
          onClick={() => setExpanded((prev) => !prev)}
          className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 md:px-6 md:py-4 select-none hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground shrink-0"
            >
              <ChevronRight className="size-5" />
            </motion.div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-foreground text-sm md:text-base leading-snug">
                  {comision.nombre}
                </h3>
                {!comision.activo && (
                  <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                    Inactiva
                  </span>
                )}
              </div>
              {comision.descripcion && !expanded && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {comision.descripcion}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {planTrabajo ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVerPlan}
                disabled={isGenerandoUrl}
                className="h-8 text-xs gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                title={`Ver Plan de Trabajo ${año}`}
              >
                {isGenerandoUrl ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileText className="size-3.5" />
                )}
                <span className="hidden sm:inline">Ver Plan</span>
              </Button>
            ) : (
              <div
                className="hidden md:flex items-center gap-1 rounded-xl border border-dashed px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                title={`Sin plan de trabajo cargado en ${año}`}
              >
                <Clock className="size-3 text-muted-foreground/70" />
                <span>Sin plan</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Users className="size-3.5 text-celeste-trifinio" />
              <span>
                {integrantes.length} {integrantes.length === 1 ? "miembro" : "miembros"}
              </span>
            </div>

            <div className="flex items-center gap-1 border-l pl-2 border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAsignar(comision);
                }}
                className="h-8 text-xs gap-1 border-celeste-trifinio/40 text-celeste-trifinio hover:bg-celeste-trifinio/10"
                title="Asignar integrante"
              >
                <UserPlus className="size-3.5" />
                <span className="hidden md:inline">Asignar</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar(comision);
                }}
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Editar comisión"
              >
                <Pencil className="size-3.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleToggleActivo}
                className="size-8 text-muted-foreground hover:text-foreground"
                title={comision.activo ? "Desactivar" : "Activar"}
              >
                {comision.activo ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="size-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.35, ease: ACCORDION_EASE },
                opacity: { duration: 0.25, ease: ACCORDION_EASE },
              }}
              className="overflow-hidden border-t bg-muted/10"
            >
              <div className="p-4 md:p-6 space-y-5">
                {comision.descripcion && (
                  <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border">
                    <span className="font-semibold text-foreground">Propósito: </span>
                    {comision.descripcion}
                  </div>
                )}

                {/* SECCIÓN MIEMBROS DE LA COMISIÓN */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Users className="size-4 text-celeste-trifinio" />
                      Miembros de la Comisión ({integrantes.length}) — Año {año}
                    </h4>
                  </div>

                  {integrantes.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                      No hay miembros asignados a esta comisión en {año}.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {integrantesOrdenados.map((int) => {
                        const esCoordinador = Boolean(int.es_coordinador);
                        return (
                          <div
                            key={int.id}
                            className={cn(
                              "flex items-center justify-between rounded-xl border p-3 shadow-xs transition-all",
                              esCoordinador
                                ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                                : "bg-card hover:border-celeste-trifinio/30"
                            )}
                          >
                            <div className="min-w-0 pr-2 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-foreground text-xs md:text-sm truncate">
                                  {int.nombre}
                                </p>
                                {esCoordinador && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-500 shrink-0">
                                    <Crown className="size-3 text-amber-500" /> Coordinador
                                  </span>
                                )}
                              </div>
                              {int.dpi && (
                                <p className="text-[11px] text-muted-foreground">
                                  DPI: {int.dpi}
                                </p>
                              )}
                              {int.rol && (
                                <span className="inline-block mt-0.5 text-[10px] font-semibold text-celeste-trifinio">
                                  {int.rol}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Switch Coordinador (visible e interactivo para super / admin) */}
                              {puedeGestionarCoordinador && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCoordinador(int)}
                                  disabled={cambiarCoordinadorMutation.isPending}
                                  className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1",
                                    esCoordinador
                                      ? "bg-amber-500"
                                      : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600",
                                    cambiarCoordinadorMutation.isPending && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={
                                    esCoordinador
                                      ? "Coordinador actual de la comisión"
                                      : "Designar como coordinador"
                                  }
                                  aria-label={`Coordinador ${int.nombre}`}
                                >
                                  <span
                                    className={cn(
                                      "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                                      esCoordinador ? "translate-x-4" : "translate-x-0"
                                    )}
                                  />
                                </button>
                              )}

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) =>
                                  handleEliminarIntegrante(
                                    e,
                                    int.id,
                                    int.nombre ?? "usuario",
                                    esCoordinador,
                                  )
                                }
                                className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                title="Remover de la comisión"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    </>
  );
}
