"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
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
import { useComisiones, useAsignarIntegrante } from "../lib/hooks";
import type { ComisionRecord } from "../lib/zod";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: { id: string; nombre: string } | null;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function AsignarPersonaDesdePuestoModal({
  open,
  onOpenChange,
  persona,
}: Props) {
  const { data: comisiones = [], isLoading } = useComisiones();
  const asignarMutation = useAsignarIntegrante();

  const [query, setQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(false);
  const [comisionSeleccionada, setComisionSeleccionada] = useState<ComisionRecord | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setComisionSeleccionada(null);
      setOpenDropdown(false);
    }
  }, [open]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const comisionesActivas = useMemo(
    () => comisiones.filter((c) => c.activo),
    [comisiones],
  );

  const filteredComisiones = useMemo(() => {
    const term = normalizeSearchText(query.trim());
    if (term.length < 1) return comisionesActivas;
    return comisionesActivas.filter((c) =>
      normalizeSearchText(c.nombre).includes(term),
    );
  }, [comisionesActivas, query]);

  const handleGuardar = async () => {
    if (!persona || !comisionSeleccionada) return;

    const añoActual = new Date().getFullYear();

    try {
      const res = await asignarMutation.mutateAsync({
        comisionId: comisionSeleccionada.id,
        values: {
          id_integrante: persona.id,
          año: añoActual,
        },
      });

      if (res.success) {
        toast.success(
          `${persona.nombre} fue asignado/a a ${comisionSeleccionada.nombre} (${añoActual}).`,
        );
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "No se pudo realizar la asignación.");
      }
    } catch {
      toast.error("Ocurrió un error inesperado al asignar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Asignar a comisión
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleGuardar();
          }}
          className="space-y-4 py-2"
        >
          {persona && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-semibold">
                Persona
              </Label>
              <p className="text-sm font-bold text-foreground bg-muted/40 px-3 py-2 rounded-xl border">
                {persona.nombre}
              </p>
            </div>
          )}

          <div ref={containerRef} className="relative space-y-2">
            <Label htmlFor="comision-search">Comisión</Label>
            <Input
              id="comision-search"
              placeholder={isLoading ? "Cargando comisiones..." : "Buscar o seleccionar comisión..."}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setComisionSeleccionada(null);
                setOpenDropdown(true);
              }}
              onFocus={() => setOpenDropdown(true)}
              onClick={() => setOpenDropdown(true)}
              autoComplete="off"
            />

            {comisionSeleccionada && (
              <button
                type="button"
                onClick={() => {
                  setComisionSeleccionada(null);
                  setQuery("");
                  setOpenDropdown(true);
                }}
                className="cursor-pointer text-xs font-semibold text-celeste-trifinio hover:underline"
              >
                Limpiar selección
              </button>
            )}

            {openDropdown && (
              <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                {isLoading ? (
                  <li className="px-3 py-2.5 text-xs text-muted-foreground">
                    Cargando comisiones...
                  </li>
                ) : filteredComisiones.length === 0 ? (
                  <li className="px-3 py-2.5 text-xs text-muted-foreground">
                    Sin coincidencias
                  </li>
                ) : (
                  filteredComisiones.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left text-xs transition-colors hover:bg-celeste-trifinio/10",
                          comisionSeleccionada?.id === c.id && "bg-celeste-trifinio/15 font-semibold text-celeste-trifinio",
                        )}
                        onClick={() => {
                          setComisionSeleccionada(c);
                          setQuery(c.nombre);
                          setOpenDropdown(false);
                        }}
                      >
                        <span className="font-semibold text-foreground">
                          {c.nombre}
                        </span>
                        {c.descripcion && (
                          <span className="text-[11px] text-muted-foreground line-clamp-1">
                            {c.descripcion}
                          </span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={!comisionSeleccionada || !persona || asignarMutation.isPending}
            >
              {asignarMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
