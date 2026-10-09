"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Layers,
  TreePine,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import AnimatedIcon from "@/components/ui/AnimatedIcon";
import { OrganigramaIcon } from "../organizacion-jerarquica/OrganigramaIcon";
import {
  useEstructuraTerritorial,
  useEliminarComunidad,
} from "./lib/hooks";
import { useAsignarPersonaAPuesto } from "../organizacion-jerarquica/lib/hooks";
import { confirmarDesasignarPersona } from "../organizacion-jerarquica/lib/swal";
import {
  OrganizacionTerritorialTree,
  type TerritorialAdminHandlers,
} from "./OrganizacionTerritorialTree";
import { OrganizacionTerritorialSkeleton } from "./OrganizacionTerritorialSkeleton";
import { OrganigramaTerritorialVertical } from "./OrganigramaTerritorialVertical";
import { CrearTerritorio } from "./forms/CrearTerritorio";
import { VerEditarTerritorio } from "./forms/VerEditarTerritorio";
import { AsignarPersonaPuesto } from "../organizacion-jerarquica/forms/AsignarPersona";
import { ReubicarPuestoModal } from "../organizacion-jerarquica/forms/ReubicarPuesto";
import { VerEditarEstructura } from "../organizacion-jerarquica/forms/VerEditar";
import { GestorAcreditacionesModal } from "../organizacion-jerarquica/forms/GestorAcreditacionesModal";
import { GestionarResolucionModal } from "./forms/GestionarResolucionModal";
import {
  TIPO_LABELS,
  type NodoTerritorial,
  type TipoLugar,
} from "./lib/zod";
import { CrearEstructura } from "../organizacion-jerarquica/forms/Crear";
import {
  ModalConfirmDelete,
  modalActionMessage,
} from "@/components/ui/general-modal";

// Helper para contar tipos
function contarTiposTerritorio(nodos: NodoTerritorial[]) {
  let microrregiones = 0;
  let aldeas = 0;
  let caserios = 0;

  function walk(items: NodoTerritorial[]) {
    for (const item of items) {
      if (item.tipo === "microrregion") microrregiones++;
      else if (item.tipo === "aldea") aldeas++;
      else if (item.tipo === "caserio") caserios++;
      if (item.hijos) walk(item.hijos);
    }
  }

  walk(nodos);
  return { microrregiones, aldeas, caserios };
}

export function OrganizacionTerritorial() {
  const { effectiveRole } = useUserContext();
  const { data, isLoading, isError } = useEstructuraTerritorial();
  const eliminar = useEliminarComunidad();

  const [organigramaOpen, setOrganigramaOpen] = useState(false);

  // Modales
  const [modalCrear, setModalCrear] = useState<{
    tipo: TipoLugar;
    parentId: string | null;
  } | null>(null);

  const [modalEditar, setModalEditar] = useState<{
    id: string;
    nombre: string;
    tipo: TipoLugar;
    tieneHijos: boolean;
    parentId: string | null;
  } | null>(null);

  const [modalEliminar, setModalEliminar] = useState<{
    id: string;
    nombre: string;
    tipo: TipoLugar;
    tieneHijos: boolean;
  } | null>(null);

  const nodos = data?.data ?? [];
  const estaVacio = nodos.length === 0;
  const counts = useMemo(() => contarTiposTerritorio(nodos), [nodos]);

  const desasignarPersonaMutation = useAsignarPersonaAPuesto();

  const [modalPuesto, setModalPuesto] = useState<{
    comunidadId: string;
    comunidadNombre: string;
  } | null>(null);

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
  }>({ open: false, puestoId: null, puestoNombre: "", departamentoActualId: null });

  const [editarPuestoId, setEditarPuestoId] = useState<string | null>(null);

  const [acreditacionesModal, setAcreditacionesModal] = useState<{
    open: boolean;
    puestoId: string | null;
    puestoNombre: string;
  }>({ open: false, puestoId: null, puestoNombre: "" });

  const [resolucionModal, setResolucionModal] = useState<{
    open: boolean;
    comunidadId: string | null;
    comunidadNombre: string;
  }>({ open: false, comunidadId: null, comunidadNombre: "" });

  const desasignarPersona = useCallback(
    async (puestoId: string, _puestoNombre: string, titularNombre: string) => {
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

  const adminHandlers: TerritorialAdminHandlers = useMemo(
    () => ({
      onAddComunidad: (parentId, tipo) => setModalCrear({ parentId, tipo }),
      onAddPuesto: async (comunidadId, comunidadNombre) => {
        try {
          const { obtenerOManutenerDepartamentoComunidad } = await import("./lib/actions");
          const { departamentoId, error } = await obtenerOManutenerDepartamentoComunidad(comunidadId, comunidadNombre);
          if (error || !departamentoId) {
            toast.error("No se pudo obtener o crear el departamento de la comunidad.");
            return;
          }
          setModalPuesto({ comunidadId: departamentoId, comunidadNombre });
        } catch {
          toast.error("Error al preparar el puesto.");
        }
      },
      onEditComunidad: (id, nombre, tipo, tieneHijos, parentId) => 
        setModalEditar({ id, nombre, tipo, tieneHijos, parentId }),
      onDeleteComunidad: (id, nombre, tipo, tieneHijos) =>
        setModalEliminar({ id, nombre, tipo, tieneHijos }),
      onAsignarPersona: (puestoId, puestoNombre) => setAsignar({ open: true, puestoId, puestoNombre }),
      onDesasignarPersona: desasignarPersona,
      onReubicarPuesto: (puestoId, puestoNombre) => setReubicar({ open: true, puestoId, puestoNombre, departamentoActualId: null }),
      onEditPuesto: (puestoId) => setEditarPuestoId(puestoId),
      onGestionarAcreditaciones: (puestoId, puestoNombre) => setAcreditacionesModal({ open: true, puestoId, puestoNombre }),
      onGestionarResolucion: (comunidadId, comunidadNombre) => setResolucionModal({ open: true, comunidadId, comunidadNombre }),
    }),
    [desasignarPersona],
  );

  const handleEliminar = async () => {
    if (!modalEliminar) return;
    const res = await eliminar.mutateAsync(modalEliminar.id);
    if (res.success) {
      toast.success("Eliminado correctamente.");
      setModalEliminar(null);
    } else {
      toast.error(
        res.error === "HAS_CHILDREN"
          ? "No se puede eliminar: tiene lugares dependientes."
          : modalActionMessage(res.error ?? undefined, "No se pudo eliminar."),
      );
      setModalEliminar(null);
    }
  };

  if (!isSuperOrAdminRole(effectiveRole)) {
    return null;
  }

  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-size-[24px_24px] opacity-50 dark:bg-[radial-gradient(oklch(36%_0_0)_1px,transparent_1px)] dark:opacity-40" />

      <div className="relative z-10 mx-auto w-full max-w-[min(100%,1600px)] space-y-4 md:space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0 px-4 md:gap-5 md:px-0">
            <div className="flex size-14 md:size-24 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-zinc-100 p-1.5 shadow-sm md:p-2 dark:bg-zinc-800">
              <AnimatedIcon iconKey="giblkgwf" size={56} speed={1.5} />
            </div>
            <div className="space-y-2 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                COMUDE
              </p>
              <h1 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">
                Cocodes y Territorio
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
                Mapa geográfico del municipio · Gestión de Microrregiones, Aldeas y Caseríos.
              </p>
            </div>
          </div>

          {!isLoading && !isError && (
            <div className="flex shrink-0 w-full flex-col gap-2 px-4 sm:flex-row sm:items-center md:px-0 lg:w-auto">
              {!estaVacio && (
                <button
                  type="button"
                  onClick={() => setOrganigramaOpen(true)}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-card px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/10 sm:w-auto"
                >
                  <OrganigramaIcon className="size-4" />
                  Ver organigrama
                </button>
              )}
            </div>
          )}
        </div>

        {/* Estado de Carga */}
        {isLoading ? (
          <OrganizacionTerritorialSkeleton />
        ) : isError ? (
          <div className="mx-4 rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center md:mx-0">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              No se pudo cargar la estructura territorial.
            </p>
          </div>
        ) : (
          <OrganizacionTerritorialTree
            nodos={nodos}
            counts={counts}
            adminHandlers={adminHandlers}
          />
        )}
      </div>

      {/* Modal Organigrama Fullscreen D3 */}
      {organigramaOpen && (
        <OrganigramaTerritorialVertical
          nodos={nodos}
          onClose={() => setOrganigramaOpen(false)}
        />
      )}

      {/* Form Crear */}
      {modalCrear && (
        <CrearTerritorio
          open={true}
          onClose={() => setModalCrear(null)}
          tipo={modalCrear.tipo}
          parentId={modalCrear.parentId}
          nodos={nodos}
        />
      )}

      {/* Form Editar */}
      {modalEditar && (
        <VerEditarTerritorio
          open={true}
          onClose={() => setModalEditar(null)}
          id={modalEditar.id}
          nombreInicial={modalEditar.nombre}
          tipo={modalEditar.tipo}
          tieneHijos={modalEditar.tieneHijos}
          parentId={modalEditar.parentId}
          nodos={nodos}
          onDelete={() => {
            setModalEditar(null);
            setModalEliminar({
              id: modalEditar.id,
              nombre: modalEditar.nombre,
              tipo: modalEditar.tipo,
              tieneHijos: modalEditar.tieneHijos,
            });
          }}
        />
      )}

      {/* Modal Eliminar */}
      {modalEliminar && (
        <ModalConfirmDelete
          open={true}
          onClose={() => setModalEliminar(null)}
          onConfirm={handleEliminar}
          title={`¿Eliminar ${TIPO_LABELS[modalEliminar.tipo]}?`}
          description={
            modalEliminar.tieneHijos
              ? `"${modalEliminar.nombre}" tiene lugares dependientes. Debes eliminarlos primero.`
              : `Se eliminará "${modalEliminar.nombre}" permanentemente.`
          }
          loading={eliminar.isPending}
          hideConfirm={modalEliminar.tieneHijos}
        />
      )}

      {/* Modal Crear Puesto Territorio */}
      {modalPuesto && (
        <CrearEstructura
          open={true}
          onOpenChange={(op) => !op && setModalPuesto(null)}
          tipo="puesto"
          presetDepartamentoId={modalPuesto.comunidadId}
        />
      )}

      {/* Modal Asignar Persona a Puesto */}
      <AsignarPersonaPuesto
        open={asignar.open}
        onOpenChange={(op) => !op && setAsignar({ open: false, puestoId: null, puestoNombre: "" })}
        puestoId={asignar.puestoId}
        puestoNombre={asignar.puestoNombre}
      />

      {/* Modal Reubicar Puesto */}
      <ReubicarPuestoModal
        open={reubicar.open}
        onOpenChange={(op) => !op && setReubicar({ open: false, puestoId: null, puestoNombre: "", departamentoActualId: null })}
        puestoId={reubicar.puestoId}
        puestoNombre={reubicar.puestoNombre}
        departamentoActualId={reubicar.departamentoActualId}
      />

      {/* Modal Editar Puesto */}
      {editarPuestoId && (
        <VerEditarEstructura
          open={true}
          onOpenChange={(op) => !op && setEditarPuestoId(null)}
          tipo="puesto"
          id={editarPuestoId}
          puedeEliminar={true}
        />
      )}

      {/* Modal Acreditaciones */}
      <GestorAcreditacionesModal
        open={acreditacionesModal.open}
        onOpenChange={(op) => !op && setAcreditacionesModal({ open: false, puestoId: null, puestoNombre: "" })}
        puestoId={acreditacionesModal.puestoId}
        puestoNombre={acreditacionesModal.puestoNombre}
      />

      {/* Modal Resolución COCODE */}
      <GestionarResolucionModal
        open={resolucionModal.open}
        onOpenChange={(op) => !op && setResolucionModal({ open: false, comunidadId: null, comunidadNombre: "" })}
        comunidadId={resolucionModal.comunidadId}
        comunidadNombre={resolucionModal.comunidadNombre}
      />
    </div>
  );
}
