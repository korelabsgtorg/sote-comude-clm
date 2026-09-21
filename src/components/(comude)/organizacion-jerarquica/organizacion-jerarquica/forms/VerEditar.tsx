"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Loader2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  useEditarDepartamento,
  useEditarPuesto,
  useEliminarDepartamento,
  useEliminarPuesto,
  useDepartamentos,
  useEstructuraOrganizacional,
  usePuestos,
} from "../lib/hooks";
import {
  buscarNodoPorId,
  departamentoFormSchema,
  puestoFormSchema,
  type DepartamentoRecord,
  type PuestoRecord,
} from "../lib/zod";
import {
  avisoNoEliminableEstructura,
  confirmarEliminacionEstructura,
} from "../lib/swal";
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
import {
  DEMO_GUARDAR_MENSAJE,
  departamentoDemoDesdeId,
  nodoDemoTieneHijos,
  puestoDemoDesdeId,
} from "../lib/estructura-simulada";
import type { NodoOrganizacion } from "../lib/zod";

function EditarDepartamentoBody({
  departamento,
  onClose,
  puedeEliminar,
  modoDemo = false,
  estructuraDemo,
}: {
  departamento: DepartamentoRecord;
  onClose: () => void;
  puedeEliminar: boolean;
  modoDemo?: boolean;
  estructuraDemo?: NodoOrganizacion;
}) {
  const editar = useEditarDepartamento();
  const eliminar = useEliminarDepartamento();
  const { data: departamentos = [] } = useDepartamentos();
  const { data: puestos = [] } = usePuestos();

  const [nombre, setNombre] = useState(departamento.nombre);
  const [descripcion, setDescripcion] = useState(departamento.descripcion ?? "");
  const [jalarJefes, setJalarJefes] = useState(Boolean(departamento.jalar_jefes_territoriales));
  const [eliminando, setEliminando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    setNombre(departamento.nombre);
    setDescripcion(departamento.descripcion ?? "");
    setJalarJefes(Boolean(departamento.jalar_jefes_territoriales));
  }, [departamento]);

  const tieneHijos = useMemo(() => {
    if (modoDemo && estructuraDemo) {
      return nodoDemoTieneHijos(departamento.id, estructuraDemo);
    }
    const subdependencias = departamentos.filter(
      (d) => d.parent_id === departamento.id,
    ).length;
    const puestosEnDep = puestos.filter(
      (p) => p.departamento_id === departamento.id,
    ).length;
    return subdependencias > 0 || puestosEnDep > 0;
  }, [departamento.id, departamentos, puestos, modoDemo, estructuraDemo]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warn("Escribe un nombre válido.");
      return;
    }
    if (modoDemo) {
      toast.warn(DEMO_GUARDAR_MENSAJE);
      onClose();
      return;
    }
    const values = departamentoFormSchema.safeParse({
      nombre,
      parent_id: departamento.parent_id,
      descripcion,
      orden: departamento.orden,
      jalar_jefes_territoriales: jalarJefes,
    });
    if (!values.success) {
      toast.warn("Escribe un nombre válido.");
      return;
    }
    const res = await editar.mutateAsync({
      id: departamento.id,
      values: values.data,
    });
    if (res.success) {
      toast.success("Departamento actualizado.");
      onClose();
    } else {
      toast.error(modalActionMessage(res.error ?? undefined, "No se pudo guardar."));
    }
  };

  const ejecutarEliminar = async () => {
    const res = await eliminar.mutateAsync(departamento.id);
    if (res.success) {
      toast.success("Departamento eliminado.");
      onClose();
      return;
    }
    toast.error(modalActionMessage(res.error ?? undefined, "No se pudo eliminar."));
  };

  const handleEliminarClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirmando || eliminando || eliminar.isPending) return;
    
    setConfirmando(true);
    try {
      if (modoDemo) {
      if (tieneHijos) {
        await avisoNoEliminableEstructura({
          title: "No se puede eliminar",
          text: "Esta dependencia tiene subdependencias o puestos. Elimínalos o reubícalos antes de continuar.",
        });
        return;
      }
      const result = await confirmarEliminacionEstructura({
        title: "¿Eliminar dependencia?",
        text: `Se eliminaría "${departamento.nombre}" (solo demo).`,
      });
      if (!result.isConfirmed) return;
      toast.warn(DEMO_GUARDAR_MENSAJE);
      onClose();
      return;
    }

    if (tieneHijos) {
      await avisoNoEliminableEstructura({
        title: "No se puede eliminar",
        text: "Esta dependencia tiene subdependencias o puestos. Elimínalos o reubícalos antes de continuar.",
      });
      return;
    }

    const result = await confirmarEliminacionEstructura({
      title: "¿Eliminar dependencia?",
      text: `Se eliminará "${departamento.nombre}". Esta acción no se puede deshacer.`,
    });

    if (!result.isConfirmed) return;

    setEliminando(true);
    try {
      await ejecutarEliminar();
    } finally {
      setEliminando(false);
    }
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleGuardar}
      className="space-y-5"
    >
      <div className="grid gap-2">
        <FormLabel htmlFor="nombre-edit">Nombre</FormLabel>
        <FormInput
          id="nombre-edit"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <FormLabel htmlFor="descripcion-edit">
          Descripción{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </FormLabel>
        <FormTextarea
          id="descripcion-edit"
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
          <FormLabel htmlFor="jalarJefes-edit" className="mb-0 cursor-pointer font-bold" onClick={() => setJalarJefes(!jalarJefes)}>
            Consolidar Líderes Territoriales (COCODES)
          </FormLabel>
          <p className="text-[11px] text-muted-foreground">
            Jala automáticamente a los presidentes/jefes de las aldeas y caseríos.
          </p>
        </div>
      </div>

      {puedeEliminar ? (
        <button
          type="button"
          onClick={handleEliminarClick}
          disabled={confirmando || eliminando || eliminar.isPending}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 text-[10px] font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {eliminando || eliminar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Eliminar departamento
        </button>
      ) : null}

      <FormFooter>
        <FormSubmitButton disabled={editar.isPending}>
          {editar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Guardar"
          )}
        </FormSubmitButton>
      </FormFooter>
    </motion.form>
  );
}

function EditarPuestoBody({
  puesto,
  onClose,
  puedeEliminar,
  modoDemo = false,
  estructuraDemo,
}: {
  puesto: PuestoRecord;
  onClose: () => void;
  puedeEliminar: boolean;
  modoDemo?: boolean;
  estructuraDemo?: NodoOrganizacion;
}) {
  const editar = useEditarPuesto();
  const eliminar = useEliminarPuesto();
  const { data: estructura } = useEstructuraOrganizacional();

  const [nombre, setNombre] = useState(puesto.nombre);
  const [jefaturaIds, setJefaturaIds] = useState(puesto.jefatura_ids);
  const [fecha, setFecha] = useState(puesto.fecha || "");
  const [activo, setActivo] = useState(puesto.activo ?? true);
  const [eliminando, setEliminando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const tieneHijos = useMemo(() => {
    if (modoDemo && estructuraDemo) {
      return nodoDemoTieneHijos(puesto.id, estructuraDemo);
    }
    if (!estructura) return false;
    const nodo = buscarNodoPorId(estructura, puesto.id);
    return (nodo?.hijos?.length ?? 0) > 0;
  }, [estructura, puesto.id, modoDemo, estructuraDemo]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warn("Escribe un nombre válido.");
      return;
    }
    if (modoDemo) {
      toast.warn(DEMO_GUARDAR_MENSAJE);
      onClose();
      return;
    }
    const values = puestoFormSchema.safeParse({
      nombre,
      departamento_id: puesto.departamento_id,
      jefatura_ids: jefaturaIds,
      orden: puesto.orden,
      fecha: fecha || null,
      activo,
    });
    if (!values.success) {
      toast.warn("Escribe un nombre válido.");
      return;
    }
    const res = await editar.mutateAsync({ id: puesto.id, values: values.data });
    if (res.success) {
      toast.success("Puesto actualizado.");
      onClose();
    } else {
      toast.error(modalActionMessage(res.error ?? undefined, "No se pudo guardar."));
    }
  };

  const ejecutarEliminar = async () => {
    const res = await eliminar.mutateAsync(puesto.id);
    if (res.success) {
      toast.success("Puesto eliminado.");
      onClose();
      return;
    }
    toast.error(modalActionMessage(res.error ?? undefined, "No se pudo eliminar."));
  };

  const handleEliminarClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirmando || eliminando || eliminar.isPending) return;

    setConfirmando(true);
    try {
      if (modoDemo) {
      if (tieneHijos) {
        await avisoNoEliminableEstructura({
          title: "No se puede eliminar",
          text: "Este puesto tiene dependencias o puestos bajo su cargo. Elimínalos o reubícalos antes de continuar.",
        });
        return;
      }
      const result = await confirmarEliminacionEstructura({
        title: "¿Eliminar puesto?",
        text: `Se eliminaría "${puesto.nombre}" (solo demo).`,
      });
      if (!result.isConfirmed) return;
      toast.warn(DEMO_GUARDAR_MENSAJE);
      onClose();
      return;
    }

    if (tieneHijos) {
      await avisoNoEliminableEstructura({
        title: "No se puede eliminar",
        text: "Este puesto tiene dependencias o puestos bajo su cargo. Elimínalos o reubícalos antes de continuar.",
      });
      return;
    }

    const result = await confirmarEliminacionEstructura({
      title: "¿Eliminar puesto?",
      text: `Se eliminará "${puesto.nombre}". Esta acción no se puede deshacer.`,
    });

    if (!result.isConfirmed) return;

    setEliminando(true);
    try {
      await ejecutarEliminar();
    } finally {
      setEliminando(false);
    }
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleGuardar}
      className="space-y-5"
    >
      <div className="grid gap-2">
        <FormLabel htmlFor="nombre-edit-puesto">Nombre</FormLabel>
        <FormInput
          id="nombre-edit-puesto"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      {!modoDemo && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <FormLabel htmlFor="fecha-edit">
              Fecha <span className="font-normal text-muted-foreground">(opcional)</span>
            </FormLabel>
            <FormInput
              id="fecha-edit"
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
            <FormLabel htmlFor="activo-edit" className="mb-0 cursor-pointer" onClick={() => setActivo(!activo)}>
              Puesto activo
            </FormLabel>
          </div>
        </div>
      )}

      {modoDemo ? (
        <p className="text-xs text-muted-foreground">
          En producción aquí se editan las jefaturas del puesto.
        </p>
      ) : (
        <JefaturasField
          departamentoId={puesto.departamento_id ?? undefined}
          selectedIds={jefaturaIds}
          onChange={setJefaturaIds}
        />
      )}

      {puedeEliminar ? (
        <button
          type="button"
          onClick={handleEliminarClick}
          disabled={confirmando || eliminando || eliminar.isPending}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 text-[10px] font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {eliminando || eliminar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Eliminar puesto
        </button>
      ) : null}

      <FormFooter>
        <FormSubmitButton disabled={editar.isPending}>
          {editar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Guardar"
          )}
        </FormSubmitButton>
      </FormFooter>
    </motion.form>
  );
}

export function VerEditarEstructura({
  open,
  onOpenChange,
  tipo,
  id,
  puedeEliminar,
  modoDemo = false,
  estructuraDemo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "departamento" | "puesto";
  id: string | null;
  puedeEliminar: boolean;
  modoDemo?: boolean;
  estructuraDemo?: NodoOrganizacion;
}) {
  const { data: departamentos = [] } = useDepartamentos();
  const { data: puestos = [] } = usePuestos();

  const departamento = modoDemo
    ? id
      ? departamentoDemoDesdeId(id, estructuraDemo)
      : null
    : (departamentos.find((d) => d.id === id) ?? null);
  const puesto = modoDemo
    ? id
      ? puestoDemoDesdeId(id, estructuraDemo)
      : null
    : (puestos.find((p) => p.id === id) ?? null);
  const onClose = () => onOpenChange(false);
  const registroListo =
    tipo === "departamento" ? Boolean(departamento) : Boolean(puesto);

  return (
    <EstructuraFormShell
      open={open}
      onClose={onClose}
      title={tipo === "departamento" ? "Editar departamento" : "Editar puesto"}
      subtitle={
        modoDemo ? "Vista demo · sin guardar cambios" : "Modificar estructura"
      }
    >
      {open && tipo === "departamento" && departamento && (
        <EditarDepartamentoBody
          key={departamento.id}
          departamento={departamento}
          onClose={onClose}
          puedeEliminar={puedeEliminar}
          modoDemo={modoDemo}
          estructuraDemo={estructuraDemo}
        />
      )}
      {open && tipo === "puesto" && puesto && (
        <EditarPuestoBody
          key={puesto.id}
          puesto={puesto}
          onClose={onClose}
          puedeEliminar={puedeEliminar}
          modoDemo={modoDemo}
          estructuraDemo={estructuraDemo}
        />
      )}
      {open && !registroListo && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {modoDemo
            ? "No se encontró el elemento en la estructura demo."
            : "Cargando..."}
        </div>
      )}
    </EstructuraFormShell>
  );
}
