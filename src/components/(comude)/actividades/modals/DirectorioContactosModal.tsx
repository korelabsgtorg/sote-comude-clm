"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Phone,
  Loader2,
  Users,
  UserRound,
  PhoneOff,
} from "lucide-react";
import { useContactos } from "../lib/hooks";
import { cn } from "@/lib/utils";

// ── Icono SVG de WhatsApp ──────────────────────────────────────────────────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatWaNumber(telefono: string): string {
  const limpio = telefono.replace(/\D/g, "");
  return limpio.length > 8 ? limpio : `502${limpio}`;
}

function initials(nombre: string): string {
  const partes = nombre.trim().split(" ").filter(Boolean);
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

const ROL_LABEL: Record<string, string> = {
  super: "Super Admin",
  admin: "Administrador",
  observatorio: "Observatorio",
  comunicacion: "Comunicación",
};

function rolLabel(rol: string | null): string {
  if (!rol) return "Usuario";
  return ROL_LABEL[rol.toLowerCase()] ?? rol;
}

const ROL_COLOR: Record<string, string> = {
  super: "bg-violet-500/15 text-violet-500",
  admin: "bg-azul-trifinio/15 text-azul-trifinio",
  observatorio: "bg-amber-500/15 text-amber-600",
  comunicacion: "bg-emerald-500/15 text-emerald-600",
};

function rolColor(rol: string | null): string {
  if (!rol) return "bg-muted/60 text-muted-foreground";
  return ROL_COLOR[rol.toLowerCase()] ?? "bg-muted/60 text-muted-foreground";
}

// Color del avatar según rol
const AVATAR_COLOR: Record<string, string> = {
  super: "from-violet-500 to-purple-600",
  admin: "from-blue-500 to-azul-trifinio",
  observatorio: "from-amber-400 to-orange-500",
  comunicacion: "from-emerald-400 to-teal-600",
};

function avatarGradient(rol: string | null): string {
  if (!rol) return "from-slate-400 to-slate-600";
  return AVATAR_COLOR[rol.toLowerCase()] ?? "from-slate-400 to-slate-600";
}

// ── Props ──────────────────────────────────────────────────────────────────
interface DirectorioContactosModalProps {
  isOpen: boolean;
  onClose: () => void;
  effectiveRole: string;
  userId?: string | null;
}

export default function DirectorioContactosModal({
  isOpen,
  onClose,
  effectiveRole,
  userId,
}: DirectorioContactosModalProps) {
  const [search, setSearch] = useState("");
  const isSuperViewer = effectiveRole === "super";

  const { data: contactos = [], isLoading, isError } = useContactos(isSuperViewer, { enabled: isOpen });

  const filtrados = contactos.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const conTelefono = filtrados.filter((c) => c.telefono).length;

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 30 }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        className="relative w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85dvh] sm:max-w-4xl bg-white dark:bg-[#0f0f0f] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-white/10 dark:border-white/5 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Banner decorativo ───────────────────────────────────────────── */}
        <div className="relative h-20 overflow-hidden shrink-0 bg-gradient-to-br from-azul-trifinio via-blue-600 to-indigo-700">
          {/* Círculos decorativos */}
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-xl" />
          <div className="absolute -bottom-8 -left-4 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-20 bg-white/5 rounded-full blur-lg" />

          {/* Contenido del banner */}
          <div className="absolute inset-0 flex items-center gap-4 px-6">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg tracking-tight leading-tight">
                Directorio de Contactos
              </h2>
              {!isLoading && !isError && (
                <p className="text-blue-100/80 text-sm mt-0.5 font-medium">
                  {filtrados.length} contacto{filtrados.length !== 1 ? "s" : ""}
                  {conTelefono > 0 && (
                    <span className="ml-2 opacity-70">· {conTelefono} con teléfono</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Botón cerrar */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer backdrop-blur-sm border border-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Buscador ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-border/50 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-azul-trifinio/40 transition-all placeholder:text-muted-foreground/60 font-medium"
            />
          </div>
        </div>

        {/* ── Lista ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">

          {/* Estado carga (Skeleton) */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-300">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border/30 bg-black/[0.02] dark:bg-white/[0.03] animate-pulse"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-neutral-800 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded w-2/5" />
                      <div className="h-4 bg-slate-100 dark:bg-neutral-800/60 rounded-full w-14" />
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-neutral-800/60 rounded w-3/5" />
                    <div className="h-2.5 bg-slate-100 dark:bg-neutral-800/40 rounded w-1/4" />
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-neutral-800 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Estado error */}
          {isError && (
            <div className="text-center py-12 text-destructive text-sm">
              Error al cargar los contactos.
            </div>
          )}

          {/* Lista vacía */}
          {!isLoading && !isError && filtrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center">
                <UserRound className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                {search ? "Sin resultados para esa búsqueda." : "No hay contactos disponibles."}
              </p>
            </div>
          )}

          {/* Filas en grid para Desktop */}
          {!isLoading && !isError && filtrados.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtrados.map((contacto, i) => {
                const tieneTelefono = !!contacto.telefono;
                const isMe = contacto.id === userId;

            return (
              <motion.div
                key={contacto.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all group",
                  isMe
                    ? "bg-black/[0.02] dark:bg-white/[0.03] border-azul-trifinio shadow-sm"
                    : "bg-black/[0.02] dark:bg-white/[0.03] border-border/30 hover:border-azul-trifinio/25 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                )}
              >
                {/* Avatar con gradiente */}
                <div
                  className={cn(
                    "w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 text-white font-black text-sm select-none shadow-sm",
                    avatarGradient(contacto.rol)
                  )}
                >
                  {initials(contacto.nombre)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-foreground truncate leading-none">
                      {contacto.nombre}
                    </p>
                    {isMe && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full leading-none bg-azul-trifinio text-white">
                        Tú
                      </span>
                    )}
                    {!isMe && (
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full leading-none",
                          rolColor(contacto.rol)
                        )}
                      >
                        {rolLabel(contacto.rol)}
                      </span>
                    )}
                  </div>

                  {/* Teléfono o N/A */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {tieneTelefono ? (
                      <p className="text-[12px] text-muted-foreground font-mono tracking-wider">
                        {contacto.telefono}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                        <PhoneOff className="w-3 h-3" />
                        <span className="font-semibold">N/A</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  {tieneTelefono ? (
                    <>
                      {/* Llamar */}
                      <a
                        href={`tel:${contacto.telefono!.replace(/\D/g, "")}`}
                        title="Llamar"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 hover:scale-110 transition-all shadow-sm border border-sky-500/10"
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      {/* WhatsApp */}
                      <a
                        href={`https://wa.me/${formatWaNumber(contacto.telefono!)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en WhatsApp"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 hover:scale-110 transition-all shadow-sm border border-green-500/10"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </a>
                    </>
                  ) : (
                    /* Sin teléfono: botones deshabilitados */
                    <>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/30 text-muted-foreground/30 cursor-not-allowed border border-border/20">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/30 text-muted-foreground/30 cursor-not-allowed border border-border/20">
                        <WhatsAppIcon className="w-4 h-4" />
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
