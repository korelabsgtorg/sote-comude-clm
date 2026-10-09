"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useCrearComunidad } from "../lib/hooks";
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

export function CrearTerritorio({
  open,
  onClose,
  tipo,
  parentId = null,
  nodos = [],
}: {
  open: boolean;
  onClose: () => void;
  tipo: TipoLugar;
  parentId?: string | null;
  nodos?: NodoTerritorial[];
}) {
  const [nombre, setNombre] = useState("");
  const crearComunidad = useCrearComunidad();
  const guardando = crearComunidad.isPending;

  const lugaresPlanos = useMemo(() => aplanarLugares(nodos), [nodos]);
  const duplicado = useMemo(
    () => (nombre.trim() ? buscarLugarDuplicado(nombre, lugaresPlanos) : null),
    [nombre, lugaresPlanos],
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

    const res = await crearComunidad.mutateAsync(values);
    if (res.success) {
      toast.success(`${TIPO_LABELS[tipo]} creado correctamente.`);
      onClose();
    } else {
      toast.error(modalActionMessage(res.error ?? undefined, "No se pudo guardar."));
    }
  };

  return (
    <TerritorioFormShell
      open={open}
      onClose={onClose}
      title={`Nuevo ${TIPO_LABELS[tipo]}`}
      subtitle={
        parentId
          ? "Dentro de una unidad territorial existente"
          : "En el nivel principal del municipio"
      }
    >
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid gap-2">
          <FormLabel htmlFor="nombre">Nombre del {TIPO_LABELS[tipo]}</FormLabel>
          <FormInput
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={`Ej: ${tipo === "microrregion" ? "Microrregión Norte" : tipo === "aldea" ? "Aldea Las Flores" : "Caserío El Río"}`}
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
                Ya existe un lugar registrado con el nombre{" "}
                <strong className="text-foreground">&quot;{duplicado.nombre}&quot;</strong> (
                {TIPO_LABELS[duplicado.tipo]} en {duplicado.fullPath}).
              </p>
            </div>
          </motion.div>
        )}

        <FormFooter>
          <FormSubmitButton disabled={guardando || Boolean(duplicado)}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
          </FormSubmitButton>
        </FormFooter>
      </motion.form>
    </TerritorioFormShell>
  );
}
