"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  UserPlus,
  Trash2,
  Pencil,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComisionRecord, ComisionIntegranteRecord } from "../lib/zod";
import { useEliminarIntegrante, useAlternarEstadoComision } from "../lib/hooks";
import { toast } from "react-toastify";

interface Props {
  comision: ComisionRecord;
  integrantes: ComisionIntegranteRecord[];
  año: number;
  onEditar: (comision: ComisionRecord) => void;
  onAsignar: (comision: ComisionRecord) => void;
  defaultExpanded?: boolean;
}

const ACCORDION_EASE = [0.33, 1, 0.68, 1] as const;

export function ComisionAccordionItem({
  comision,
  integrantes,
  año,
  onEditar,
  onAsignar,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const eliminarMutation = useEliminarIntegrante(año);
  const alternarEstadoMutation = useAlternarEstadoComision();

  const handleEliminarIntegrante = async (
    e: React.MouseEvent,
    idAsignacion: string,
    nombre: string,
  ) => {
    e.stopPropagation();
    if (!confirm(`¿Desea remover a ${nombre} de esta comisión en el año ${año}?`)) {
      return;
    }

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
            <div className="p-4 md:p-6 space-y-4">
              {comision.descripcion && (
                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border">
                  <span className="font-semibold text-foreground">Propósito: </span>
                  {comision.descripcion}
                </div>
              )}

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
                    {integrantes.map((int) => (
                      <div
                        key={int.id}
                        className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-xs transition-all hover:border-celeste-trifinio/30"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-foreground text-xs md:text-sm truncate">
                            {int.nombre}
                          </p>
                          {int.dpi && (
                            <p className="text-[11px] text-muted-foreground">
                              DPI: {int.dpi}
                            </p>
                          )}
                          {int.rol && (
                            <span className="inline-block mt-1 text-[10px] font-semibold text-celeste-trifinio">
                              {int.rol}
                            </span>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) =>
                            handleEliminarIntegrante(
                              e,
                              int.id,
                              int.nombre ?? "usuario",
                            )
                          }
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          title="Remover de la comisión"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
