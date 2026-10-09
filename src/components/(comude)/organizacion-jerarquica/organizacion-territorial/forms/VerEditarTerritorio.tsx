"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEditarComunidad } from "../lib/hooks";
import {
  TIPO_LABELS,
  type TipoLugar,
  type ComunidadFormValues,
  type NodoTerritorial,
  aplanarLugares,
  buscarLugarDuplicado,
} from "../lib/zod";
import {
  TerritorioFormShell,
  FormInput,
  FormLabel,
  FormSubmitButton,
  FormFooter,
  modalActionMessage,
  toast,
} from "./TerritorioFormShell";
import { Button } from "@/components/ui/button";

export function VerEditarTerritorio({
  open,
  onClose,
  id,
  nombreInicial,
  tipo,
  tieneHijos,
  parentId,
  onDelete,
  nodos = [],
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  nombreInicial: string;
  tipo: TipoLugar;
  tieneHijos: boolean;
  parentId: string | null;
  onDelete: () => void;
  nodos?: NodoTerritorial[];
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const editarComunidad = useEditarComunidad();
  const guardando = editarComunidad.isPending;

  const lugaresPlanos = useMemo(() => aplanarLugares(nodos), [nodos]);
  const duplicado = useMemo(
    () =>
      nombre.trim() && nombre.trim().toLowerCase() !== nombreInicial.trim().toLowerCase()
        ? buscarLugarDuplicado(nombre, lugaresPlanos, id)
        : null,
    [nombre, nombreInicial, lugaresPlanos, id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.warn("Escribe un nombre válido.");
      return;
    }

    if (duplicado) {
      toast.error(
        `Ya existe un lugar registrado con el nombre "${duplicado.nombre}" (${TIPO_LABELS[duplicado.tipo]}).`,
      );
      return;
    }

    const values: ComunidadFormValues = {
      nombre: nombreLimpio,
      tipo,
      parent_id: parentId,
    };

    const res = await editarComunidad.mutateAsync({ id, values });
    if (res.success) {
      toast.success("Actualizado correctamente.");
      onClose();
    } else {
      toast.error(modalActionMessage(res.error ?? undefined, "No se pudo actualizar."));
    }
  };

  return (
    <TerritorioFormShell
      open={open}
      onClose={onClose}
      title={`Editar ${TIPO_LABELS[tipo]}`}
      subtitle={`Cambia la información de "${nombreInicial}"`}
    >
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid gap-2">
          <FormLabel htmlFor="nombre">Nombre</FormLabel>
          <FormInput
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
        </div>

        {duplicado && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Lugar ya registrado</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Ya existe otro lugar registrado con el nombre{" "}
                <strong className="text-foreground">&quot;{duplicado.nombre}&quot;</strong> (
                {TIPO_LABELS[duplicado.tipo]} en {duplicado.fullPath}).
              </p>
            </div>
          </motion.div>
        )}

        <FormFooter>
          <div className="flex flex-col gap-2 w-full">
            <Button
              type="button"
              variant="destructive"
              className="w-full rounded-xl font-bold"
              onClick={onDelete}
              disabled={guardando}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>

            <FormSubmitButton disabled={guardando || Boolean(duplicado)}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar cambios"}
            </FormSubmitButton>
          </div>
        </FormFooter>
      </motion.form>
    </TerritorioFormShell>
  );
}
