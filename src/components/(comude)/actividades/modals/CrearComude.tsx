"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Loader2, CalendarDays, Users } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useCrearActividad, useEditarActividad } from "../lib/hooks";
import { CrearActividadValues, ActComudeConParticipantes } from "../lib/zod";
import { useUsers } from "@/components/(base)/(users)/usuarios/lib/hooks";
import { toast } from "react-toastify";

interface CrearComudeProps {
  isOpen: boolean;
  onClose: () => void;
  actorRole: string;
  actividad?: ActComudeConParticipantes;
}

type ParticipanteSeleccionado = {
  usuario_id: string;
  nombre: string;
  encargado: boolean;
};

const TABS = [
  { id: "info", label: "Información", icon: CalendarDays },
  { id: "participantes", label: "Participantes", icon: Users },
] as const;
type Tab = typeof TABS[number]["id"];

export default function CrearComude({ isOpen, onClose, actorRole, actividad }: CrearComudeProps) {
  const [tab, setTab] = useState<Tab>("info");
  const [titulo, setTitulo] = useState(actividad?.detalles_sesion?.titulo || "");
  const [acta, setActa] = useState(actividad?.detalles_sesion?.acta || "");
  const [libro, setLibro] = useState(actividad?.detalles_sesion?.libro || "");

  // Fecha from ISO to YYYY-MM-DDTHH:MM format for datetime-local
  const parseInitialDate = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [fecha, setFecha] = useState(parseInitialDate(actividad?.fecha));
  
  const [participantes, setParticipantes] = useState<ParticipanteSeleccionado[]>(
    actividad?.act_comude_participantes.map(p => ({
      usuario_id: p.usuario_id,
      nombre: p.profiles?.nombre || "Sin nombre",
      encargado: p.encargado
    })) || []
  );
  const [busqueda, setBusqueda] = useState("");
  const [mounted, setMounted] = useState(false);

  const { mutateAsync: crear, isPending: isCreando } = useCrearActividad();
  const { mutateAsync: editar, isPending: isEditando } = useEditarActividad();
  const isPending = isCreando || isEditando;
  const isEditMode = !!actividad;

  const { data: usuarios } = useUsers(actorRole);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && actividad) {
      setTitulo(actividad.detalles_sesion?.titulo || "");
      setActa(actividad.detalles_sesion?.acta || "");
      setLibro(actividad.detalles_sesion?.libro || "");
      setFecha(parseInitialDate(actividad.fecha));
      setParticipantes(
        actividad.act_comude_participantes.map(p => ({
          usuario_id: p.usuario_id,
          nombre: p.profiles?.nombre || "Sin nombre",
          encargado: p.encargado
        }))
      );
    }
  }, [isOpen, actividad]);

  // Bloquear scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  const resetForm = () => {
    if (!isEditMode) {
      setTitulo("");
      setActa("");
      setLibro("");
      setFecha("");
      setParticipantes([]);
    }
    setBusqueda("");
    setTab("info");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Participantes
  const toggleParticipante = (usuario: { id: string; nombre: string | null }) => {
    const existe = participantes.find((p) => p.usuario_id === usuario.id);
    if (existe) {
      setParticipantes((prev) => prev.filter((p) => p.usuario_id !== usuario.id));
    } else {
      setParticipantes((prev) => [
        ...prev,
        { usuario_id: usuario.id, nombre: usuario.nombre ?? "Sin nombre", encargado: false },
      ]);
    }
  };

  const toggleEncargado = (usuario_id: string) => {
    setParticipantes((prev) =>
      prev.map((p) =>
        p.usuario_id === usuario_id ? { ...p, encargado: !p.encargado } : p
      )
    );
  };

  const usuariosFiltrados = (usuarios ?? []).filter((u) =>
    (u.nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!titulo.trim()) { toast.error("El título es obligatorio"); setTab("info"); return; }
    if (!fecha) { toast.error("La fecha es obligatoria"); setTab("info"); return; }
    if (participantes.length === 0) { toast.error("Agrega al menos un participante"); setTab("participantes"); return; }

    const values: CrearActividadValues = {
      titulo: titulo.trim(),
      acta: acta.trim(),
      libro: libro.trim(),
      fecha,
      participantes: participantes.map((p) => ({ usuario_id: p.usuario_id, encargado: p.encargado })),
    };

    try {
      if (isEditMode) {
        await editar({ id: actividad.id, values });
        toast.success("✅ COMUDE actualizado exitosamente");
      } else {
        await crear(values);
        toast.success("✅ COMUDE creado exitosamente");
      }
      handleClose();
    } catch (err) {
      toast.error(`Error al ${isEditMode ? 'actualizar' : 'crear'} el COMUDE. Intenta de nuevo.`);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="crear-comude-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-6"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-[100dvh] sm:h-[580px] sm:max-w-xl bg-white dark:bg-[#1a1a1a] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[88vh]"
            style={{ 
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)"
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/50">
              <div>
                <h2 className="font-bold text-foreground text-xl">
                  {isEditMode ? "Editar COMUDE" : "Nuevo COMUDE"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isEditMode ? "Modifica la información para programar la reunión." : "Complete la información para programar la reunión."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex justify-center sm:justify-start border-b border-border/50 px-2 sm:px-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-2 text-sm py-3.5 px-4 border-b-2 -mb-px font-semibold transition-colors flex-none",
                    tab === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {tab === "info" && (
                <>
                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80">Título</label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ej. Sesión Ordinaria de enero"
                      className="w-full rounded-xl border border-border/50 px-4 py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-2 block text-foreground/80">Acta</label>
                      <input
                        type="text"
                        value={acta}
                        onChange={(e) => setActa(e.target.value)}
                        placeholder="Ej. 1-2025"
                        className="w-full rounded-xl border border-border/50 px-4 py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-2 block text-foreground/80">Libro</label>
                      <input
                        type="text"
                        value={libro}
                        onChange={(e) => setLibro(e.target.value)}
                        placeholder="Ej. 01"
                        className="w-full rounded-xl border border-border/50 px-4 py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80">Fecha de reunión</label>
                    <input
                      type="datetime-local"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full rounded-xl border border-border/50 px-4 py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50 dark:[color-scheme:dark] [color-scheme:light]"
                    />
                  </div>
                </>
              )}

              {tab === "participantes" && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar usuario..."
                    className="w-full rounded-xl border border-border/50 px-4 py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />

                  {participantes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seleccionados ({participantes.length})</p>
                      {participantes.map((p) => (
                        <div key={p.usuario_id} className="flex items-center justify-between text-sm bg-muted/30 border border-border/50 rounded-xl px-4 py-3">
                          <span className="font-semibold text-foreground">{p.nombre}</span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={p.encargado}
                                onChange={() => toggleEncargado(p.usuario_id)}
                                className="w-4 h-4 accent-primary"
                              />
                              Encargado
                            </label>
                            <button onClick={() => toggleParticipante({ id: p.usuario_id, nombre: p.nombre })} className="p-1">
                              <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1 max-h-60 overflow-y-auto rounded-xl border border-border/50">
                    {usuariosFiltrados.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No se encontraron usuarios.</p>
                    )}
                    {usuariosFiltrados.map((u) => {
                      const seleccionado = participantes.some((p) => p.usuario_id === u.id);
                      if (seleccionado) return null;
                      return (
                        <button
                          key={u.id}
                          onClick={() => toggleParticipante(u)}
                          className="w-full flex items-center justify-between text-sm px-4 py-3 hover:bg-muted/60 transition-colors text-left"
                        >
                          <span className="font-medium text-foreground">{u.nombre ?? "Sin nombre"}</span>
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-border/50 flex items-center justify-between gap-3 bg-muted/10">
              <div className="flex gap-1.5">
                {TABS.map(({ id }) => (
                  <div key={id} className={cn("w-2 h-2 rounded-full transition-all duration-300", tab === id ? "bg-primary scale-110" : "bg-muted-foreground/30")} />
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 disabled:opacity-60 transition-colors"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPending ? (isEditMode ? "Guardando..." : "Creando...") : (isEditMode ? "Guardar Cambios" : "Crear COMUDE")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
