"use client";

import { useState, useMemo } from "react";
import { Loader2, UserCheck, ArrowRightLeft } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSustituirParticipante } from "../lib/hooks";
import { useEstructuraOrganizacional } from "@/components/(comude)/organizacion-jerarquica/organizacion-jerarquica/lib/hooks";
import { NodoOrganizacion } from "@/components/(comude)/organizacion-jerarquica/organizacion-jerarquica/lib/zod";
import { useUsers } from "@/components/(base)/(users)/usuarios/lib/hooks";
import { ActComudeParticipante } from "../lib/zod";

export interface OpcionSustituto {
  id: string;
  nombre: string;
  puestoNombre?: string | null;
}

interface SustituirParticipanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  actComudeId: string;
  tituloActividad: string;
  userId?: string | null;
  effectiveRole?: string;
  participantesActuales?: (ActComudeParticipante & { profiles?: { nombre: string; rol: string } | null })[];
}

export default function SustituirParticipanteModal({
  isOpen,
  onClose,
  actComudeId,
  tituloActividad,
  userId,
  effectiveRole,
  participantesActuales = [],
}: SustituirParticipanteModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");

  const esSuper = effectiveRole === "super";
  const { data: estructuraOrg, isLoading: isLoadingEstructura } = useEstructuraOrganizacional();
  const { data: allUsers, isLoading: isLoadingUsers } = useUsers(effectiveRole);
  const cargandoSustitutos = esSuper ? isLoadingUsers : isLoadingEstructura;

  const sustitutosDisponibles: OpcionSustituto[] = useMemo(() => {
    if (!userId || !isOpen) return [];

    const participantesIds = new Set(participantesActuales.map((p) => p.usuario_id));

    if (esSuper) {
      return (allUsers || [])
        .filter((u) => u.id !== userId && !participantesIds.has(u.id))
        .map((u) => ({
          id: u.id,
          nombre: u.nombre || "Sin nombre",
          puestoNombre: u.rol ? `Rol: ${u.rol}` : null,
        }));
    }

    if (!estructuraOrg) return [];

    let nodoUsuario: NodoOrganizacion | null = null;
    function buscarNodo(nodo: NodoOrganizacion) {
      if (nodo.tipo === "unidad" && nodo.titular_id === userId) {
        nodoUsuario = nodo;
        return;
      }
      for (const hijo of nodo.hijos || []) {
        buscarNodo(hijo);
        if (nodoUsuario) return;
      }
    }
    buscarNodo(estructuraOrg);

    if (!nodoUsuario) return [];

    const subordinadosMap = new Map<string, OpcionSustituto>();
    function recolectarSubordinados(nodo: NodoOrganizacion) {
      if (nodo.tipo === "unidad" && nodo.titular_id && nodo.titular) {
        if (nodo.titular_id !== userId && !participantesIds.has(nodo.titular_id)) {
          subordinadosMap.set(nodo.titular_id, {
            id: nodo.titular_id,
            nombre: nodo.titular,
            puestoNombre: nodo.nombre,
          });
        }
      }
      for (const hijo of nodo.hijos || []) {
        recolectarSubordinados(hijo);
      }
    }

    for (const hijo of (nodoUsuario as NodoOrganizacion).hijos || []) {
      recolectarSubordinados(hijo);
    }

    return Array.from(subordinadosMap.values());
  }, [userId, isOpen, participantesActuales, esSuper, allUsers, estructuraOrg]);

  const { mutateAsync: sustituir, isPending } = useSustituirParticipante();

  const handleClose = () => {
    setSelectedUserId("");
    setBusqueda("");
    onClose();
  };

  const listaFiltrada = sustitutosDisponibles.filter((s) =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (s.puestoNombre && s.puestoNombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast.warning("Por favor selecciona a la persona que será tu suplente.");
      return;
    }

    const elegido = sustitutosDisponibles.find((s) => s.id === selectedUserId);

    const result = await Swal.fire({
      title: "¿Confirmar suplente?",
      text: `Se designará a "${elegido?.nombre || "la persona seleccionada"}" como suplente para que asista en tu lugar al COMUDE. Se le enviará una notificación push inmediatamente.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#1a73e8",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, asignar suplente",
      cancelButtonText: "Cancelar",
      didOpen: () => {
        const swalContainer = Swal.getContainer();
        if (swalContainer) {
          swalContainer.style.zIndex = "999999";
        }
      },
    });

    if (result.isConfirmed) {
      try {
        await sustituir({
          actComudeId,
          nuevoUsuarioId: selectedUserId,
        });
        toast.success("Suplente asignado con éxito. Notificación enviada.");
        handleClose();
      } catch (err: any) {
        toast.error(err.message || "No se pudo asignar al suplente.");
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden rounded-2xl gap-0 border border-border/60 shadow-2xl"
        showCloseButton={true}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-border/50 bg-muted/20 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-azul-trifinio/10 text-azul-trifinio shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div className="min-w-0 pr-6">
              <DialogTitle className="font-bold text-foreground text-base leading-tight">
                Asignar Suplente
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                {tituloActividad}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {cargandoSustitutos ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-azul-trifinio" />
              <span className="text-xs">Cargando personas disponibles...</span>
            </div>
          ) : sustitutosDisponibles.length === 0 ? (
            <div className="py-8 text-center px-4">
              <UserCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">
                Sin suplentes disponibles
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {esSuper
                  ? "No hay usuarios disponibles en el municipio para asignar."
                  : "No tienes personal activo asignado bajo tu cargo en la estructura organizacional para asignar como suplente."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar suplente por nombre o puesto..."
                className="w-full rounded-xl border border-border/50 px-3.5 py-2.5 text-xs bg-background/50 focus:outline-none focus:ring-1 focus:ring-azul-trifinio"
              />

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {listaFiltrada.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No se encontraron resultados.
                  </p>
                ) : (
                  listaFiltrada.map((item) => {
                    const isSelected = selectedUserId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedUserId(item.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "bg-azul-trifinio/10 border-azul-trifinio text-foreground font-medium shadow-sm"
                            : "bg-muted/30 border-border/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {item.nombre}
                          </p>
                          {item.puestoNombre && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {item.puestoNombre}
                            </p>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-azul-trifinio bg-azul-trifinio text-white"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border/50 bg-muted/10 flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !selectedUserId || cargandoSustitutos || sustitutosDisponibles.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-azul-trifinio text-white hover:bg-azul-trifinio/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Asignando...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Asignar Suplente</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
