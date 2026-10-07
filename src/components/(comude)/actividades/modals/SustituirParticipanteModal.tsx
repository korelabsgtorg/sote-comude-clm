"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, UserCheck, ArrowRightLeft } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { useSustituirParticipante } from "../lib/hooks";

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
  sustitutosDisponibles: OpcionSustituto[];
  cargandoSustitutos?: boolean;
  esSuperOAdmin?: boolean;
}

export default function SustituirParticipanteModal({
  isOpen,
  onClose,
  actComudeId,
  tituloActividad,
  sustitutosDisponibles,
  cargandoSustitutos = false,
  esSuperOAdmin = false,
}: SustituirParticipanteModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");

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
      toast.warning("Por favor selecciona a la persona que te sustituirá.");
      return;
    }

    const elegido = sustitutosDisponibles.find((s) => s.id === selectedUserId);

    const result = await Swal.fire({
      title: "¿Confirmar sustitución?",
      text: `Se designará a "${elegido?.nombre || "la persona seleccionada"}" para que asista en tu lugar al COMUDE. Se le enviará una notificación push inmediatamente.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#1a73e8",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, delegar asistencia",
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
        toast.success("Sustitución realizada con éxito. Notificación enviada.");
        handleClose();
      } catch (err: any) {
        toast.error(err.message || "No se pudo realizar la sustitución.");
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="sustituir-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-h-[90dvh] sm:max-w-md bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-azul-trifinio/10 text-azul-trifinio">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base leading-tight">
                  Sustituir Asistencia
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                  {tituloActividad}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
            {cargandoSustitutos ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-azul-trifinio" />
                <span className="text-xs">Cargando personas disponibles...</span>
              </div>
            ) : sustitutosDisponibles.length === 0 ? (
              <div className="py-8 text-center px-4">
                <UserCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">
                  Sin sustitutos disponibles
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {esSuperOAdmin
                    ? "No hay usuarios disponibles en el municipio para asignar."
                    : "No tienes personas activas asignadas bajo tu jefatura en la estructura organizacional."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar sustituto por nombre o puesto..."
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
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !selectedUserId || cargandoSustitutos || sustitutosDisponibles.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-azul-trifinio text-white hover:bg-azul-trifinio/90 transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Delegando...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Delegar Asistencia</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
