"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Loader2, CalendarDays, Users, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCrearActividad, useEditarActividad } from "../lib/hooks";
import { CrearActividadValues, ActComudeConParticipantes } from "../lib/zod";
import { useUsers } from "@/components/(base)/(users)/usuarios/lib/hooks";
import { useEstructuraOrganizacional } from "@/components/(comude)/organizacion-jerarquica/organizacion-jerarquica/lib/hooks";
import { NodoOrganizacion } from "@/components/(comude)/organizacion-jerarquica/organizacion-jerarquica/lib/zod";
import { toast } from "react-toastify";
import { notifyActividadPendienteRefresh } from "@/components/push/PushListener";

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

/** Extrae de forma recursiva únicamente los titulares que tienen jefatura o representan COCODES/líderes */
function extraerJefaturasYCocodesDeEstructura(nodo: NodoOrganizacion | null | undefined): ParticipanteSeleccionado[] {
  if (!nodo) return [];

  const participantesMap = new Map<string, ParticipanteSeleccionado>();

  function recorrer(n: NodoOrganizacion) {
    // Si es un nodo de puesto ("unidad") con titular asignado
    if (n.tipo === "unidad" && n.titular_id && n.titular) {
      // Debe tener indicador de jefatura
      if (n.tiene_jefaturas) {
        if (!participantesMap.has(n.titular_id)) {
          participantesMap.set(n.titular_id, {
            usuario_id: n.titular_id,
            nombre: n.titular,
            encargado: false,
          });
        }
      }
    }

    if (Array.isArray(n.hijos)) {
      for (const hijo of n.hijos) {
        recorrer(hijo);
      }
    }
  }

  recorrer(nodo);
  return Array.from(participantesMap.values());
}

export default function CrearComude({ isOpen, onClose, actorRole, actividad }: CrearComudeProps) {
  // Fecha from ISO to YYYY-MM-DDTHH:MM format for datetime-local
  const parseInitialDate = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [tab, setTab] = useState<Tab>("info");
  const [titulo, setTitulo] = useState(() => actividad?.detalles_sesion?.titulo || "");
  const [acta, setActa] = useState(() => actividad?.detalles_sesion?.acta || "");
  const [libro, setLibro] = useState(() => actividad?.detalles_sesion?.libro || "");
  const [ubicacion, setUbicacion] = useState(() => actividad?.ubicacion || "Gimnasio Municipal");
  const [fecha, setFecha] = useState(() => parseInitialDate(actividad?.fecha));
  
  const [participantes, setParticipantes] = useState<ParticipanteSeleccionado[]>(() =>
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
  const { data: estructuraOrg, isLoading: isLoadingEstructura } = useEstructuraOrganizacional();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sincronizar datos si cambia la actividad o si es nuevo COMUDE y se carga la estructura
  useEffect(() => {
    if (!isOpen) return;

    if (actividad) {
      setTitulo(actividad.detalles_sesion?.titulo || "");
      setActa(actividad.detalles_sesion?.acta || "");
      setLibro(actividad.detalles_sesion?.libro || "");
      setUbicacion(actividad.ubicacion || "");
      setFecha(parseInitialDate(actividad.fecha));
      setParticipantes(
        (actividad.act_comude_participantes || []).map(p => ({
          usuario_id: p.usuario_id,
          nombre: p.profiles?.nombre || "Sin nombre",
          encargado: p.encargado
        }))
      );
    } else if (estructuraOrg && participantes.length === 0) {
      const autoParticipantes = extraerJefaturasYCocodesDeEstructura(estructuraOrg);
      setParticipantes(autoParticipantes);
    }
  }, [isOpen, actividad, estructuraOrg]);

  // Bloquear scroll de manera segura sin layout shift
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const resetForm = () => {
    if (!isEditMode) {
      setTitulo("");
      setActa("");
      setLibro("");
      setUbicacion("Gimnasio Municipal");
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
      ubicacion: ubicacion.trim() || "Gimnasio Municipal",
      fecha,
      participantes: participantes.map((p) => ({ usuario_id: p.usuario_id, encargado: p.encargado })),
    };

    try {
      if (isEditMode) {
        await editar({ id: actividad.id, values });
        notifyActividadPendienteRefresh();
        toast.success("✅ COMUDE actualizado exitosamente");
      } else {
        await crear(values);
        notifyActividadPendienteRefresh();
        toast.success("✅ COMUDE creado exitosamente");
      }
      handleClose();
    } catch (err) {
      toast.error(`Error al ${isEditMode ? 'actualizar' : 'crear'} el COMUDE. Intenta de nuevo.`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:w-full sm:max-w-xl h-[590px] sm:h-[600px] max-h-[92vh] bg-white dark:bg-[#1a1a1a] p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col border-border/60 gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-border/50 shrink-0">
          <div>
            <DialogTitle className="font-bold text-foreground text-lg sm:text-xl">
              {isEditMode ? "Editar COMUDE" : "Nuevo COMUDE"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              {isEditMode ? "Modifica la información para programar la reunión." : "Complete la información para programar la reunión."}
            </DialogDescription>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center border-b border-border/50 px-4 sm:px-6 gap-2 sm:gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 text-sm py-3 px-4 border-b-2 -mb-px font-semibold transition-colors cursor-pointer",
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

        {/* Contenido con altura consistente */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-4">
          {tab === "info" && (
            <>
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground/80">Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Sesión Ordinaria de enero"
                  className="w-full rounded-xl border border-border/50 px-4 py-2.5 sm:py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
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
                    className="w-full rounded-xl border border-border/50 px-4 py-2.5 sm:py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block text-foreground/80">Libro</label>
                  <input
                    type="text"
                    value={libro}
                    onChange={(e) => setLibro(e.target.value)}
                    placeholder="Ej. 01"
                    className="w-full rounded-xl border border-border/50 px-4 py-2.5 sm:py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground/80">Lugar del COMUDE</label>
                <input
                  type="text"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej. Salón Municipal de Reuniones"
                  className="w-full rounded-xl border border-border/50 px-4 py-2.5 sm:py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground/80">Fecha de reunión</label>
                <input
                  type="datetime-local"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-xl border border-border/50 px-4 py-2.5 sm:py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50 dark:[color-scheme:dark] [color-scheme:light]"
                />
              </div>
            </>
          )}

          {tab === "participantes" && (
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar usuario..."
                  className="w-full rounded-xl border border-border/50 px-4 py-2.5 sm:py-3 text-sm bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />

                {busqueda.trim().length > 0 && (
                  <div className="mt-2 space-y-1 max-h-44 overflow-y-auto rounded-xl border border-border/50 bg-background/80 p-1">
                    {usuariosFiltrados.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No se encontraron usuarios.</p>
                    ) : (
                      usuariosFiltrados.map((u) => {
                        const seleccionado = participantes.some((p) => p.usuario_id === u.id);
                        if (seleccionado) return null;
                        return (
                          <button
                            key={u.id}
                            onClick={() => {
                              toggleParticipante(u);
                              setBusqueda("");
                            }}
                            className="w-full flex items-center justify-between text-sm px-3.5 py-2 hover:bg-muted/60 rounded-lg transition-colors text-left"
                          >
                            <span className="font-medium text-foreground">{u.nombre ?? "Sin nombre"}</span>
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Botón para cargar miembros automáticos */}
              {estructuraOrg && (
                <button
                  type="button"
                  onClick={() => {
                    const autoParticipantes = extraerJefaturasYCocodesDeEstructura(estructuraOrg);
                    setParticipantes(autoParticipantes);
                    toast.info("Participantes restablecidos según la estructura organizacional.");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Cargar miembros de COMUDE</span>
                </button>
              )}

              {/* Cabecera de seleccionados */}
              <div className="pt-0.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Seleccionados ({participantes.length})
                </p>
              </div>

              {participantes.length > 0 ? (
                <div className="space-y-2">
                  {participantes.map((p) => (
                    <div key={p.usuario_id} className="flex items-center justify-between text-sm bg-muted/30 border border-border/50 rounded-xl px-3.5 py-2.5">
                      <span className="font-semibold text-foreground text-xs sm:text-sm truncate mr-2">{p.nombre}</span>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer select-none text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={p.encargado}
                            onChange={() => toggleEncargado(p.usuario_id)}
                            className="w-4 h-4 accent-primary"
                          />
                          Encargado
                        </label>
                        <button onClick={() => toggleParticipante({ id: p.usuario_id, nombre: p.nombre })} className="p-1 hover:bg-muted rounded cursor-pointer">
                          <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-border/50 rounded-xl">
                  No hay participantes asignados.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 bg-muted/10 shrink-0">
          <div className="flex gap-1.5">
            {TABS.map(({ id }) => (
              <div key={id} className={cn("w-2 h-2 rounded-full transition-all duration-300", tab === id ? "bg-primary scale-110" : "bg-muted-foreground/30")} />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? (isEditMode ? "Guardando..." : "Creando...") : (isEditMode ? "Guardar Cambios" : "Crear COMUDE")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
