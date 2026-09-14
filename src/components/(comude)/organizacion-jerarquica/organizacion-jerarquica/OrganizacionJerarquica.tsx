"use client";

import { useMemo, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  UserPlus,
  Briefcase,
  ListTree,
  ChevronsDown,
  Pencil,
  FlaskConical,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import AnimatedIcon from "@/components/ui/AnimatedIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import { OrganizacionTree, type AdminHandlers } from "./OrganizacionTree";
import { OrganigramaModal } from "./OrganigramaVertical";
import { OrganigramaIcon } from "./OrganigramaIcon";
import { OrganizacionSkeleton } from "./OrganizacionSkeleton";
import {
  useEstructuraOrganizacional,
  usePuestos,
  useAsignarPersonaAPuesto,
} from "./lib/hooks";
import { departamentoTieneJefe, puestosEnDepartamento } from "./lib/zod";
import { ESTRUCTURA_SIMULADA } from "./lib/estructura-simulada";
import { confirmarDesasignarPersona } from "./lib/swal";
import { modalActionMessage } from "@/components/ui/modal-toast";
import { CrearEstructura } from "./forms/Crear";
import { VerEditarEstructura } from "./forms/VerEditar";
import { AsignarPersonaPuesto } from "./forms/AsignarPersona";
import { ReubicarPuestoModal } from "./forms/ReubicarPuesto";

export function OrganizacionJerarquica() {
  const { effectiveRole } = useUserContext();
  const { data, isLoading, isError, refetch } = useEstructuraOrganizacional();
  const { data: puestos = [] } = usePuestos();
  const desasignarPersonaMutation = useAsignarPersonaAPuesto();
  const puedeEliminar = isSuperOrAdminRole(effectiveRole);

  const estructura = data ?? null;
  const [modoSimulacion, setModoSimulacion] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const estructuraMostrada = modoSimulacion
    ? ESTRUCTURA_SIMULADA
    : estructura;

  const [crear, setCrear] = useState<{
    open: boolean;
    tipo: "departamento" | "puesto";
    parentId: string | null;
    departamentoId?: string;
  }>({ open: false, tipo: "departamento", parentId: null });

  const [editar, setEditar] = useState<{
    open: boolean;
    tipo: "departamento" | "puesto";
    id: string | null;
  }>({ open: false, tipo: "departamento", id: null });

  const [asignar, setAsignar] = useState<{
    open: boolean;
    puestoId: string | null;
    puestoNombre: string;
  }>({ open: false, puestoId: null, puestoNombre: "" });

  const [reubicar, setReubicar] = useState<{
    open: boolean;
    puestoId: string | null;
    puestoNombre: string;
    departamentoActualId: string | null;
  }>({
    open: false,
    puestoId: null,
    puestoNombre: "",
    departamentoActualId: null,
  });

  const [organigramaOpen, setOrganigramaOpen] = useState(false);

  const abrirCrearDepartamento = (parentId: string | null = null) =>
    setCrear({ open: true, tipo: "departamento", parentId });

  const desasignarPersona = useCallback(
    async (puestoId: string, titularNombre: string) => {
      const result = await confirmarDesasignarPersona({
        title: "¿Desasignar persona?",
        text: `Se quitará a ${titularNombre} de este puesto.`,
      });
      if (!result.isConfirmed) return;

      const res = await desasignarPersonaMutation.mutateAsync({
        puesto_id: puestoId,
        profile_id: null,
      });

      if (res.success) {
        toast.success("Persona desasignada del puesto.");
        return;
      }

      toast.error(
        modalActionMessage(
          res.error ?? undefined,
          "No se pudo desasignar la persona.",
        ),
      );
    },
    [desasignarPersonaMutation],
  );

  const admin: AdminHandlers = useMemo(
    () => ({
      onAddDepartamento: (parentId) => abrirCrearDepartamento(parentId),
      onAddPuesto: (departamentoId) => {
        if (!modoSimulacion) {
          const enDep = puestosEnDepartamento(puestos, departamentoId);
          const tieneJefe = departamentoTieneJefe(puestos, departamentoId);
          if (enDep.length > 0 && !tieneJefe) {
            toast.warn(
              "Debe existir un jefe en esta dependencia antes de agregar más puestos.",
            );
            return;
          }
        }
        setCrear({
          open: true,
          tipo: "puesto",
          parentId: null,
          departamentoId,
        });
      },
      onAsignarPersona: (puestoId, puestoNombre) => {
        if (modoSimulacion) {
          toast.warn("Modo demo: la asignación de personas no está disponible.");
          return;
        }
        setAsignar({ open: true, puestoId, puestoNombre });
      },
      onDesasignarPersona: (puestoId, _puestoNombre, titularNombre) => {
        if (modoSimulacion) {
          toast.warn("Modo demo: la asignación de personas no está disponible.");
          return;
        }
        void desasignarPersona(puestoId, titularNombre);
      },
      onReubicarPuesto: (puestoId, puestoNombre) => {
        if (modoSimulacion) {
          toast.warn("Modo demo: reubicar puestos no está disponible.");
          return;
        }
        const puesto = puestos.find((p) => p.id === puestoId);
        setReubicar({
          open: true,
          puestoId,
          puestoNombre,
          departamentoActualId: puesto?.departamento_id ?? null,
        });
      },
      onEdit: (tipo, id) => setEditar({ open: true, tipo, id }),
    }),
    [puestos, desasignarPersona, modoSimulacion],
  );

  const estaVacio = Boolean(
    estructuraMostrada &&
      (!estructuraMostrada.hijos || estructuraMostrada.hijos.length === 0),
  );

  if (!isSuperOrAdminRole(effectiveRole)) {
    return null;
  }

  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-size-[24px_24px] opacity-50 dark:bg-[radial-gradient(oklch(36%_0_0)_1px,transparent_1px)] dark:opacity-40" />

      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-[min(100%,1600px)]",
          modoSimulacion ? "space-y-6 md:space-y-10" : "space-y-4 md:space-y-6",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0 px-4 md:gap-5 md:px-0">
            <div className="flex size-14 md:size-24 shrink-0 items-center justify-center rounded-2xl border border-celeste-trifinio/30 bg-zinc-100 p-1.5 shadow-sm md:p-2 dark:bg-zinc-800">
              <AnimatedIcon iconKey="giblkgwf" size={56} speed={1.5} />
            </div>
            <div className="space-y-2 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-celeste-trifinio">
                {modoSimulacion
                  ? "Simulación · Materiales de construcción"
                  : "COMUDE"}
              </p>
              <h1 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">
                {modoSimulacion
                  ? estructuraMostrada?.nombre ?? "Organización simulada"
                  : "Organización Administrativa"}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
                {modoSimulacion
                  ? (estructuraMostrada?.descripcion ??
                    "Estructura de ejemplo para visualizar la jerarquía de una empresa.")
                  : "Visualización jerárquica de la estructura del COMUDE."}
              </p>
            </div>
          </div>

          {!isLoading && !isError && (estructura || modoSimulacion) && (
            <div className="flex shrink-0 w-full flex-col gap-2 px-4 sm:flex-row sm:items-center md:px-0 lg:w-auto">
              <button
                type="button"
                onClick={() => setMostrarInactivos((prev) => !prev)}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:w-auto"
              >
                {mostrarInactivos ? (
                  <>
                    <EyeOff className="size-4" />
                    Ocultar inactivos
                  </>
                ) : (
                  <>
                    <Eye className="size-4" />
                    Mostrar inactivos
                  </>
                )}
              </button>
              {/* Botón Simular Empresa temporalmente oculto a petición del usuario */}
              {false && (
                <button
                  type="button"
                  onClick={() => {
                    setModoSimulacion((prev) => !prev);
                    setOrganigramaOpen(false);
                  }}
                  className={
                    modoSimulacion
                      ? "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 sm:w-auto"
                      : "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-100 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-violet-700 transition-colors hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900 sm:w-auto"
                  }
                >
                  {modoSimulacion ? (
                    <>
                      <RotateCcw className="size-4" />
                      Ver datos reales
                    </>
                  ) : (
                    <>
                      <FlaskConical className="size-4" />
                      Simular empresa
                    </>
                  )}
                </button>
              )}
              {!estaVacio && (
                <button
                  type="button"
                  onClick={() => setOrganigramaOpen(true)}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-celeste-trifinio/40 bg-card px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-celeste-trifinio transition-colors hover:bg-celeste-trifinio/10 sm:w-auto"
                >
                  <OrganigramaIcon className="size-4" />
                  Ver organigrama
                </button>
              )}
            </div>
          )}
        </div>

        <div className="max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none rounded-2xl border border-border/60 bg-zinc-100 p-0 dark:bg-zinc-800 md:p-8 lg:p-10 md:shadow-sm md:min-h-[calc(100vh-18rem)]">
          {isLoading && <OrganizacionSkeleton />}

          {!isLoading && isError && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <p className="text-sm font-bold text-destructive">
                No se pudo verificar el acceso a la estructura.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="outline" onClick={() => refetch()}>
                  Reintentar
                </Button>
                <Button onClick={() => abrirCrearDepartamento(null)}>
                  <Plus className="size-4" />
                  Crear departamento
                </Button>
              </div>
            </div>
          )}

          {modoSimulacion && (
            <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 md:mx-0">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
                Modo simulación · Construmax Materiales
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Empresa de venta de materiales de construcción. Puedes abrir los
                modales de crear y editar; los cambios no se guardan.
              </p>
            </div>
          )}

          {!isLoading && !isError && estructuraMostrada && (
            <>
              <OrganizacionTree
                estructura={estructuraMostrada}
                admin={admin}
                espaciadoVertical={modoSimulacion}
                mostrarInactivos={mostrarInactivos}
              />
            </>
          )}
        </div>
      </div>

      {estructuraMostrada && (
        <OrganigramaModal
          open={organigramaOpen}
          onClose={() => setOrganigramaOpen(false)}
          estructura={estructuraMostrada}
          admin={admin}
          usarLogoRaiz={!modoSimulacion}
          espaciadoAmplio={modoSimulacion}
        />
      )}

      <CrearEstructura
        open={crear.open}
        onOpenChange={(open) => setCrear((prev) => ({ ...prev, open }))}
        tipo={crear.tipo}
        presetParentId={crear.parentId}
        presetDepartamentoId={crear.departamentoId}
        modoDemo={modoSimulacion}
        nombreEmpresaDemo={estructuraMostrada?.nombre}
      />

      <VerEditarEstructura
        open={editar.open}
        onOpenChange={(open) => setEditar((prev) => ({ ...prev, open }))}
        tipo={editar.tipo}
        id={editar.id}
        puedeEliminar={puedeEliminar}
        modoDemo={modoSimulacion}
        estructuraDemo={modoSimulacion ? ESTRUCTURA_SIMULADA : undefined}
      />

      <AsignarPersonaPuesto
        open={asignar.open}
        onOpenChange={(open) => setAsignar((prev) => ({ ...prev, open }))}
        puestoId={asignar.puestoId}
        puestoNombre={asignar.puestoNombre}
      />

      <ReubicarPuestoModal
        open={reubicar.open}
        onOpenChange={(open) => setReubicar((prev) => ({ ...prev, open }))}
        puestoId={reubicar.puestoId}
        puestoNombre={reubicar.puestoNombre}
        departamentoActualId={reubicar.departamentoActualId}
      />
    </div>
  );
}
