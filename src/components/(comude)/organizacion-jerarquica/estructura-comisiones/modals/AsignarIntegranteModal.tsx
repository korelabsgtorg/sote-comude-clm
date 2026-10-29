"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { UserPlus, Search, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePersonasElegibles, useAsignarIntegrante } from "../lib/hooks";
import type { ComisionRecord } from "../lib/zod";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comision: ComisionRecord | null;
  año: number;
  integrantesActualesIds: string[];
}

export function AsignarIntegranteModal({
  open,
  onOpenChange,
  comision,
  año,
  integrantesActualesIds,
}: Props) {
  const { data: personas = [], isLoading } = usePersonasElegibles();
  const asignarMutation = useAsignarIntegrante();
  const [busqueda, setBusqueda] = useState("");
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string | null>(null);
  const [designarCoordinador, setDesignarCoordinador] = useState(false);

  useEffect(() => {
    if (open) {
      setDesignarCoordinador(integrantesActualesIds.length === 0);
    }
  }, [open, integrantesActualesIds.length]);

  const personasFiltradas = personas.filter((p) => {
    const yaAsignado = integrantesActualesIds.includes(p.id);
    if (yaAsignado) return false;

    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.dpi && p.dpi.toLowerCase().includes(q))
    );
  });

  const handleAsignar = async () => {
    if (!comision || !personaSeleccionadaId) return;

    try {
      const res = await asignarMutation.mutateAsync({
        comisionId: comision.id,
        values: {
          id_integrante: personaSeleccionadaId,
          año,
          es_coordinador: designarCoordinador,
        },
      });

      if (res.success) {
        toast.success("Integrante asignado a la comisión.");
        setPersonaSeleccionadaId(null);
        setBusqueda("");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "No se pudo asignar el integrante.");
      }
    } catch {
      toast.error("Ocurrió un error inesperado al asignar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-celeste-trifinio" />
            Asignar Integrante ({año})
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Comisión: <span className="font-semibold text-foreground">{comision?.nombre}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o DPI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Personas disponibles ({personasFiltradas.length})
            </Label>

            <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border p-2 bg-muted/20">
              {isLoading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Cargando perfiles...
                </p>
              ) : personasFiltradas.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No se encontraron usuarios disponibles.
                </p>
              ) : (
                personasFiltradas.map((p) => {
                  const selected = personaSeleccionadaId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersonaSeleccionadaId(p.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                        selected
                          ? "bg-celeste-trifinio/15 border-celeste-trifinio border text-foreground font-medium"
                          : "hover:bg-muted border border-transparent text-muted-foreground"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-foreground">{p.nombre}</p>
                        {p.dpi && (
                          <p className="text-[11px] text-muted-foreground">
                            DPI: {p.dpi}
                          </p>
                        )}
                      </div>
                      {selected && (
                        <span className="text-xs font-bold text-celeste-trifinio">
                          Seleccionado
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Opción para designar coordinador */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div className="space-y-0.5 pr-2">
              <div className="flex items-center gap-1.5">
                <Crown className="size-4 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  Designar como Coordinador
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {integrantesActualesIds.length === 0
                  ? "Primer integrante de la comisión. Será asignado como coordinador."
                  : "Si se activa, pasará a ser el nuevo coordinador de esta comisión."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDesignarCoordinador(!designarCoordinador)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500",
                designarCoordinador
                  ? "bg-amber-500"
                  : "bg-zinc-300 dark:bg-zinc-700"
              )}
              aria-label="Designar como coordinador"
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  designarCoordinador ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            className="w-full"
            disabled={!personaSeleccionadaId || asignarMutation.isPending}
            onClick={handleAsignar}
          >
            {asignarMutation.isPending ? "Asignando..." : "Asignar a Comisión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
