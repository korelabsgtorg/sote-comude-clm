"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useCrearDepartamento, useCrearPuesto, usePuestos, useDepartamentos } from "../lib/hooks";
import {
  departamentoFormSchema,
  departamentoTieneJefe,
  puestoFormSchema,
  puestosEnDepartamento,
  type AcreditacionFile,
} from "../lib/zod";
import {
  EstructuraFormShell,
  FormInput,
  FormLabel,
  FormSubmitButton,
  FormFooter,
  FormTextarea,
  modalActionMessage,
} from "./EstructuraFormShell";
import { JefaturasField } from "./JefaturasField";
import { DEMO_GUARDAR_MENSAJE } from "../lib/estructura-simulada";

function CrearBody({
  tipo,
  presetParentId,
  presetDepartamentoId,
  onClose,
  modoDemo = false,
}: {
  tipo: "departamento" | "puesto";
  presetParentId: string | null;
  presetDepartamentoId?: string;
  onClose: () => void;
  modoDemo?: boolean;
}) {
  const crearDepartamento = useCrearDepartamento();
  const crearPuesto = useCrearPuesto();
  const { data: puestos = [] } = usePuestos();
  const { data: departamentos = [] } = useDepartamentos();

  const esDepartamentoComunidad = useMemo(() => {
    if (!presetDepartamentoId) return false;
    const dep = departamentos.find((d) => d.id === presetDepartamentoId);
    return Boolean(dep?.comunidad_id);
  }, [departamentos, presetDepartamentoId]);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [jalarJefes, setJalarJefes] = useState(false);
  const [jefaturaIds, setJefaturaIds] = useState<string[]>([]);
  const [fecha, setFecha] = useState("");
  const [activo, setActivo] = useState(true);

  const guardando = crearDepartamento.isPending || crearPuesto.isPending;

  const puestosDep = useMemo(
    () =>
      presetDepartamentoId
        ? puestosEnDepartamento(puestos, presetDepartamentoId)
        : [],
    [puestos, presetDepartamentoId],
  );

  const requiereJefatura = useMemo(
    () =>
      Boolean(
        presetDepartamentoId &&
          !departamentoTieneJefe(puestos, presetDepartamentoId),
      ),
    [puestos, presetDepartamentoId],
  );

  // Auto-seleccionar jefatura propia si la dependencia no tiene jefe aún
  useEffect(() => {
    if (requiereJefatura && presetDepartamentoId && jefaturaIds.length === 0) {
      setJefaturaIds([presetDepartamentoId]);
    }
  }, [requiereJefatura, presetDepartamentoId, jefaturaIds.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tipo === "departamento") {
      if (!nombre.trim()) {
        toast.warn("Escribe un nombre válido para el departamento.");
        return;
      }
      if (modoDemo) {
        toast.warn(DEMO_GUARDAR_MENSAJE);
        onClose();
        return;
      }
      const values = departamentoFormSchema.safeParse({
        nombre,
        parent_id: presetParentId,
        descripcion,
        orden: 0,
        jalar_jefes_territoriales: jalarJefes,
      });
      if (!values.success) {
        toast.warn("Escribe un nombre válido para el departamento.");
        return;
      }
      const res = await crearDepartamento.mutateAsync(values.data);
      if (res.success) {
        toast.success("Departamento creado.");
        onClose();
      } else {
        toast.error(modalActionMessage(res.error ?? undefined, "No se pudo guardar."));
      }
      return;
    }

    if (!presetDepartamentoId) {
      toast.warn("Seleccione un departamento desde el árbol.");
      return;
    }

    let finalJefaturaIds = jefaturaIds;
    if (requiereJefatura && finalJefaturaIds.length === 0 && presetDepartamentoId) {
      finalJefaturaIds = [presetDepartamentoId];
    }

    if (
      !modoDemo &&
      finalJefaturaIds.length === 0 &&
      !departamentoTieneJefe(puestos, presetDepartamentoId)
    ) {
      toast.warn("Debe existir un jefe en esta dependencia antes de agregar más puestos.");
      return;
    }

    if (!nombre.trim()) {
      toast.warn("Escribe un nombre válido para el puesto.");
      return;
    }
    if (modoDemo) {
      toast.warn(DEMO_GUARDAR_MENSAJE);
      onClose();
      return;
    }

    const values = puestoFormSchema.safeParse({
      nombre,
      departamento_id: presetDepartamentoId,
      jefatura_ids: finalJefaturaIds,
      orden: 0,
      fecha: fecha || null,
      activo,
      acreditaciones: [],
    });
    if (!values.success) {
      toast.warn("Escribe un nombre válido para el puesto.");
      return;
    }
    const res = await crearPuesto.mutateAsync(values.data);
    if (res.success) {
      toast.success("Puesto creado.");
      onClose();
    } else {
      toast.error(modalActionMessage(res.error ?? undefined, "No se pudo guardar."));
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-5"
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

      {tipo === "departamento" && (
        <>
          <div className="grid gap-2">
            <FormLabel htmlFor="descripcion">
              Descripción{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </FormLabel>
            <FormTextarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              role="switch"
              aria-checked={jalarJefes}
              onClick={() => setJalarJefes(!jalarJefes)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                jalarJefes ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                  jalarJefes ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <div>
              <FormLabel htmlFor="jalarJefes" className="mb-0 cursor-pointer font-bold" onClick={() => setJalarJefes(!jalarJefes)}>
                Consolidar Líderes Territoriales (COCODES)
              </FormLabel>
              <p className="text-[11px] text-muted-foreground">
                Jala automáticamente a los presidentes/jefes de las aldeas y caseríos.
              </p>
            </div>
          </div>
        </>
      )}

      {tipo === "puesto" && requiereJefatura && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-bold flex items-center gap-1.5">
            <span>👑</span> Primer puesto del lugar
          </p>
          <p className="text-[11px] opacity-90 mt-0.5">
            Este puesto se registrará automáticamente como <strong>{esDepartamentoComunidad ? "Presidente / Líder" : "Jefatura"}</strong>.
          </p>
        </div>
      )}

      {tipo === "puesto" && !modoDemo && !requiereJefatura && (
        <JefaturasField
          departamentoId={presetDepartamentoId}
          selectedIds={jefaturaIds}
          onChange={setJefaturaIds}
          required={false}
          esComunidad={esDepartamentoComunidad}
        />
      )}

      {tipo === "puesto" && modoDemo && (
        <p className="text-xs text-muted-foreground">
          En producción aquí se asignan las jefaturas del nuevo puesto.
        </p>
      )}

      {tipo === "puesto" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <FormLabel htmlFor="fecha">
              Fecha <span className="font-normal text-muted-foreground">(opcional)</span>
            </FormLabel>
            <FormInput
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              role="switch"
              aria-checked={activo}
              onClick={() => setActivo(!activo)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                activo ? "bg-green-600" : "bg-zinc-200 dark:bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                  activo ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <FormLabel htmlFor="activo" className="mb-0 cursor-pointer" onClick={() => setActivo(!activo)}>
              Puesto activo
            </FormLabel>
          </div>
        </div>
      )}

      <FormFooter>
        <FormSubmitButton disabled={guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
        </FormSubmitButton>
      </FormFooter>
    </motion.form>
  );
}

export function CrearEstructura({
  open,
  onOpenChange,
  tipo,
  presetParentId = null,
  presetDepartamentoId,
  modoDemo = false,
  nombreEmpresaDemo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "departamento" | "puesto";
  presetParentId?: string | null;
  presetDepartamentoId?: string;
  modoDemo?: boolean;
  nombreEmpresaDemo?: string;
}) {
  const onClose = () => onOpenChange(false);
  const empresaLabel = nombreEmpresaDemo ?? "COMUDE";

  return (
    <EstructuraFormShell
      open={open}
      onClose={onClose}
      title={tipo === "departamento" ? "Nuevo departamento" : "Nuevo puesto"}
      subtitle={
        modoDemo
          ? "Vista demo · sin guardar cambios"
          : tipo === "departamento"
            ? presetParentId
              ? "Dentro de unidad existente"
              : `Dentro de ${empresaLabel}`
            : "Asignación de puesto"
      }
    >
      {open && (
        <CrearBody
          key={`${tipo}-${presetParentId ?? "root"}-${presetDepartamentoId ?? ""}-${modoDemo ? "demo" : "live"}`}
          tipo={tipo}
          presetParentId={presetParentId}
          presetDepartamentoId={presetDepartamentoId}
          onClose={onClose}
          modoDemo={modoDemo}
        />
      )}
    </EstructuraFormShell>
  );
}
