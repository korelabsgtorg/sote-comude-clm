"use client";

import { UserPlus, Trash2, Pencil, Users, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComisionRecord, ComisionIntegranteRecord } from "../lib/zod";
import { useEliminarIntegrante, useAlternarEstadoComision } from "../lib/hooks";
import { toast } from "react-toastify";

interface Props {
  comision: ComisionRecord;
  integrantes: ComisionIntegranteRecord[];
  año: number;
  onEditar: (comision: ComisionRecord) => void;
  onAsignar: (comision: ComisionRecord) => void;
}

export function ComisionCard({
  comision,
  integrantes,
  año,
  onEditar,
  onAsignar,
}: Props) {
  const eliminarMutation = useEliminarIntegrante(año);
  const alternarEstadoMutation = useAlternarEstadoComision();

  const handleEliminarIntegrante = async (idAsignacion: string, nombre: string) => {
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

  const handleToggleActivo = async () => {
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
      className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-sm ${
        comision.activo
          ? "bg-card border-border hover:border-celeste-trifinio/40"
          : "bg-muted/40 border-dashed border-muted-foreground/30 opacity-75"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="font-bold text-foreground text-base leading-snug">
              {comision.nombre}
            </h3>
            {comision.descripcion && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {comision.descripcion}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEditar(comision)}
              title="Editar nombre/descripción"
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="size-3.5 text-celeste-trifinio" />
              Integrantes ({integrantes.length}) — {año}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-celeste-trifinio/40 text-celeste-trifinio hover:bg-celeste-trifinio/10"
              onClick={() => onAsignar(comision)}
            >
              <UserPlus className="size-3" />
              Asignar
            </Button>
          </div>

          <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5">
            {integrantes.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground italic">
                Sin integrantes asignados en {año}
              </p>
            ) : (
              integrantes.map((int) => (
                <div
                  key={int.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-2.5 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {int.nombre}
                    </p>
                    {int.dpi && (
                      <p className="text-[10px] text-muted-foreground">
                        DPI: {int.dpi}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleEliminarIntegrante(int.id, int.nombre ?? "usuario")
                    }
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remover de la comisión"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px]">
        <span
          className={`font-semibold ${
            comision.activo ? "text-emerald-500" : "text-muted-foreground"
          }`}
        >
          {comision.activo ? "Activa" : "Inactiva"}
        </span>

        <button
          type="button"
          onClick={handleToggleActivo}
          className="text-muted-foreground underline hover:text-foreground"
        >
          {comision.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}
