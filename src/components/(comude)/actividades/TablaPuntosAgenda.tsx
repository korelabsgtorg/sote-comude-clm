"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";
import { Paperclip, Trash2, Pencil, Plus, Loader2, ChevronDown, FileText, X, MoreVertical, ClipboardList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActComudePunto, ActComudeCategoria, CrearPuntoValues } from "./lib/zod";
import {
  usePuntosDeActividad,
  useCrearPunto,
  useActualizarPunto,
  useEliminarPunto,
  useActualizarEstadoPunto,
  useActualizarVotacionPunto,
  useActualizarNotasPunto,
  useCategorias,
  useCrearCategoria,
} from "./lib/hooks";
import Swal from "sweetalert2";
import GestorArchivosPuntoModal from "./modals/GestorArchivosPuntoModal";
import CategoriasModal from "./modals/CategoriasModal";
import NotasModal from "./modals/NotasModal";
import ActividadesPuntoModal from "./modals/ActividadesPuntoModal";

// ─── Constantes ────────────────────────────────────────────
const ESTADOS = ["No iniciado", "En progreso", "En espera", "Aprobado", "No aprobado", "Realizado"];
const VOTACIONES = ["No emitido", "Unanimidad", "Mayoría", "Minoría", "Ver Notas", "Realizado"];

// ─── Helpers de color ──────────────────────────────────────
const statusStyles: Record<string, string> = {
  'Aprobado': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'No aprobado': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  'En progreso': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'En espera': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  'No iniciado': 'bg-white text-gray-800 border-gray-200 dark:bg-neutral-900 dark:text-gray-300 dark:border-neutral-800',
  'Realizado': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
};

const votacionStyles: Record<string, string> = {
  'No emitido': 'bg-white text-gray-800 border-gray-200 dark:bg-neutral-900 dark:text-gray-300 dark:border-neutral-800',
  'Minoría': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  'Mayoría': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  'Unanimidad': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'Ver Notas': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Realizado': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
};

function colorEstado(estado: string | null) {
  if (!estado) return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border';
  return (statusStyles[estado] || 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400') + " border";
}

function colorVotacion(votacion: string | null) {
  if (!votacion) return 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 border';
  return (votacionStyles[votacion] || 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400') + " border";
}

// ─── Contador de estados ────────────────────────────────────
export function ContadoresEstado({ 
  puntos,
  filtroEstado,
  onFiltroChange
}: { 
  puntos: ActComudePunto[];
  filtroEstado?: string | null;
  onFiltroChange?: (estado: string | null) => void;
}) {
  const conteos: Record<string, number> = {};
  for (const p of puntos) {
    const e = p.estado ?? "No iniciado";
    conteos[e] = (conteos[e] || 0) + 1;
  }
  const items = [
    { label: "EN PROGRESO",  key: "En progreso" },
    { label: "EN ESPERA",    key: "En espera" },
    { label: "NO APROBADO",  key: "No aprobado" },
    { label: "APROBADO",     key: "Aprobado" },
    { label: "NO INICIADO",  key: "No iniciado" },
    { label: "REALIZADO",    key: "Realizado" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ label, key }) => {
        const isActive = filtroEstado === key;
        const opacityClass = filtroEstado && !isActive ? "opacity-40" : "opacity-100 hover:opacity-80";
        return (
          <button 
            key={key} 
            onClick={() => onFiltroChange && onFiltroChange(isActive ? null : key)}
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-sm border cursor-pointer transition-all", 
              statusStyles[key] || "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
              opacityClass,
              isActive && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-background"
            )}
          >
            {label}: {conteos[key] ?? 0}
          </button>
        );
      })}
    </div>
  );
}

// ─── Select inline ──────────────────────────────────────────
function InlineSelect({
  value,
  options,
  onChange,
  colorFn,
  disabled,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
  colorFn: (v: string | null) => string;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-flex flex-col items-center w-full">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ textAlignLast: "center" }}
        className={cn(
          "appearance-none w-full max-w-[130px] whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight cursor-pointer outline-none",
          colorFn(value),
          disabled && "cursor-default opacity-80"
        )}
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-white dark:bg-neutral-900 text-zinc-900 dark:text-zinc-100 text-left" style={{ textAlign: "left" }}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Fila de la tabla ───────────────────────────────────────
function FilaPunto({
  punto,
  orden,
  actComudeId,
  municipioId,
  canManage,
  categorias,
  sesionEstado,
  isMobile,
  onOpenCategoriasModal,
  onOpenNotasModal,
}: {
  punto: ActComudePunto;
  orden: number;
  actComudeId: string;
  municipioId?: number | null;
  canManage: boolean;
  categorias: ActComudeCategoria[];
  sesionEstado?: string | null;
  isMobile?: boolean;
  onOpenCategoriasModal: (puntoId: string) => void;
  onOpenNotasModal: (punto: ActComudePunto) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editando, setEditando] = useState(false);
  const [tituloEdit, setTituloEdit] = useState(punto.titulo);
  const [isArchivosModalOpen, setIsArchivosModalOpen] = useState(false);
  const [isActividadesModalOpen, setIsActividadesModalOpen] = useState(false);

  const { mutateAsync: actualizarPunto, isPending: actualizando } = useActualizarPunto();
  const { mutateAsync: eliminarPunto, isPending: eliminando } = useEliminarPunto();
  const { mutateAsync: cambiarEstado } = useActualizarEstadoPunto();
  const { mutateAsync: cambiarVotacion } = useActualizarVotacionPunto();

  const handleEliminar = async () => {
    const result = await Swal.fire({
      title: "¿Eliminar punto?",
      text: `Se eliminará "${punto.titulo}"`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await eliminarPunto({ puntoId: punto.id, actComudeId });
    }
  };

  const handleGuardarTitulo = async () => {
    if (!tituloEdit.trim()) return;
    await actualizarPunto({ puntoId: punto.id, values: { titulo: tituloEdit }, actComudeId });
    setEditando(false);
  };

  const totalArchivos = punto.act_comude_archivos?.length ?? 0;
  const totalActividades = punto.actividades_count ?? 0;

  if (isMobile) {
    return (
      <>
      <div className="bg-card shadow-xs border border-border/60 rounded-xl p-4 flex flex-col gap-3 transition-all">
        {/* Cabecera de la tarjeta */}
        <div className="flex items-start justify-between gap-3 cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-muted-foreground/80 bg-muted/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                #{orden}
              </span>
              <span className={cn("text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-current/15", colorEstado(punto.estado))}>
                {punto.estado ?? "No iniciado"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsActividadesModalOpen(true);
                }}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 cursor-pointer select-none",
                  totalActividades > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                    : "bg-muted/60 text-muted-foreground border-border/70 hover:border-emerald-500/50"
                )}
                title="Ver actividades y acuerdos del punto"
              >
                <ClipboardList className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{totalActividades} {totalActividades === 1 ? "actividad" : "actividades"}</span>
              </button>
            </div>
            {editando ? (
              <div className="flex gap-1.5 items-center mt-1" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  value={tituloEdit}
                  onChange={(e) => setTituloEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGuardarTitulo();
                    if (e.key === "Escape") { setEditando(false); setTituloEdit(punto.titulo); }
                  }}
                  className="flex-1 text-sm border border-border/60 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-azul-trifinio/50 bg-background"
                />
                <button onClick={handleGuardarTitulo} disabled={actualizando} className="text-xs bg-azul-trifinio text-white px-3 py-1.5 rounded-lg font-bold">
                  {actualizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "OK"}
                </button>
              </div>
            ) : (
              <h4 className="text-sm font-bold text-foreground leading-snug tracking-tight">{punto.titulo}</h4>
            )}
          </div>
          <button 
            type="button"
            className="p-1.5 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors mt-0.5"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
          </button>
        </div>

        {/* Contenido Expandible Animado */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="mobile-expanded-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border/40 flex flex-col gap-3.5">
                
                {/* Contenedor Categoría y Votación */}
                <div className="grid grid-cols-2 gap-2.5 bg-muted/30 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-border/40">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Categoría</span>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => onOpenCategoriasModal(punto.id)}
                        className="flex justify-between items-center text-xs font-medium text-foreground bg-background dark:bg-zinc-900 border border-border/60 rounded-lg px-2.5 py-1.5 w-full hover:bg-muted/50 transition-colors"
                      >
                        <span className="truncate">{punto.categoria?.nombre ?? "Sin categoría"}</span>
                        <ChevronDown className="w-3 h-3 opacity-60 ml-1 shrink-0" />
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-foreground/90 truncate">{punto.categoria?.nombre ?? "—"}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Votación</span>
                    <InlineSelect
                      value={punto.votacion}
                      options={VOTACIONES}
                      onChange={(v) => cambiarVotacion({ puntoId: punto.id, votacion: v, actComudeId })}
                      colorFn={colorVotacion}
                      disabled={!canManage}
                    />
                  </div>
                </div>

                {/* Sección de Notas */}
                {(sesionEstado !== "Programada" && sesionEstado != null) && (
                  <div className="flex flex-col gap-1.5 bg-muted/30 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Notas y Acuerdos</span>
                    {punto.notas && punto.notas.length > 0 ? (
                      <div className="flex flex-col gap-1.5 w-full" onClick={() => canManage && onOpenNotasModal(punto)}>
                        {punto.notas.map((nota, index) => (
                          <div key={index} className={cn("w-full rounded-lg p-2 bg-background dark:bg-zinc-900 border border-border/50 shadow-2xs", canManage && "cursor-pointer hover:border-azul-trifinio/40 transition-colors")}>
                            <p className="text-xs text-foreground/90 leading-relaxed">
                              {punto.notas!.length > 1 && <span className="font-bold text-celeste-trifinio mr-1.5">{index + 1}.</span>}
                              {nota}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => canManage && onOpenNotasModal(punto)}
                        className={cn(
                          "text-xs text-left w-full block bg-background dark:bg-zinc-900 rounded-lg p-2.5 border border-border/50",
                          canManage ? "cursor-pointer hover:border-azul-trifinio/40 transition-colors text-muted-foreground italic" : "cursor-default text-muted-foreground italic"
                        )}
                      >
                        {canManage ? "+ Añadir notas o acuerdos..." : "Sin notas registradas"}
                      </button>
                    )}
                  </div>
                )}

                {/* Barra Inferior: Archivos Adjuntos y Acciones */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <button 
                    type="button"
                    onClick={() => setIsArchivosModalOpen(true)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all border shadow-2xs",
                      totalArchivos > 0
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                        : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {totalArchivos > 0
                        ? `${totalArchivos} adjunto${totalArchivos !== 1 ? "s" : ""}`
                        : canManage
                        ? "+ Adjuntar"
                        : "Sin adjuntos"}
                    </span>
                  </button>
                  
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors flex items-center justify-center border border-border/40"
                          title="Acciones"
                        >
                          {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 z-[1100] bg-white dark:bg-zinc-950 shadow-xl border border-border">
                        <DropdownMenuItem 
                          onClick={() => { setEditando(true); setTituloEdit(punto.titulo); }}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 w-4 h-4" />
                          <span>Editar</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={handleEliminar}
                          disabled={eliminando}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                        >
                          <Trash2 className="mr-2 w-4 h-4" />
                          <span>Eliminar</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <GestorArchivosPuntoModal
        isOpen={isArchivosModalOpen}
        onClose={() => setIsArchivosModalOpen(false)}
        punto={punto}
        actComudeId={actComudeId}
        municipioId={municipioId}
        canManage={canManage}
      />
      <ActividadesPuntoModal
        isOpen={isActividadesModalOpen}
        onClose={() => setIsActividadesModalOpen(false)}
        punto={punto}
        actComudeId={actComudeId}
        canManage={canManage}
      />
      </>
    );
  }

  return (
    <>
    <tr className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-muted/20 transition-colors align-middle">
      {/* # */}
      <td className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground w-10 border-r border-zinc-200 dark:border-zinc-800/80">
        {orden}
      </td>

      {/* DOCS */}
      <td className="px-2 py-2.5 text-center w-12 border-r border-zinc-200 dark:border-zinc-800/80">
        <button
          onClick={() => setIsArchivosModalOpen(true)}
          title="Documentos adjuntos"
          className="relative inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-azul-trifinio transition-colors cursor-pointer select-none group"
        >
          <Paperclip className="w-4 h-4 transition-transform group-hover:scale-110" />
          {totalArchivos > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center pointer-events-none select-none shadow-2xs">
              {totalArchivos}
            </span>
          )}
        </button>
      </td>

      {/* PUNTO A TRATAR */}
      <td className="px-1 py-2.5 w-[24%] min-w-[200px] max-w-[340px] border-r border-zinc-200 dark:border-zinc-800/80">
        {editando ? (
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={tituloEdit}
              onChange={(e) => setTituloEdit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGuardarTitulo();
                if (e.key === "Escape") { setEditando(false); setTituloEdit(punto.titulo); }
              }}
              className="flex-1 text-sm border border-border/60 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-azul-trifinio/50 bg-background"
            />
            <button onClick={handleGuardarTitulo} disabled={actualizando} className="text-xs bg-azul-trifinio text-white px-2 py-0.5 rounded font-medium">
              {actualizando ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
            </button>
            <button onClick={() => { setEditando(false); setTituloEdit(punto.titulo); }} className="text-xs bg-muted px-2 py-0.5 rounded">✕</button>
          </div>
        ) : (
          <span className="text-sm text-foreground font-medium break-words leading-snug block">{punto.titulo}</span>
        )}
      </td>

      {/* ESTADO */}
      <td className="px-2 py-2.5 w-36 text-center border-r border-zinc-200 dark:border-zinc-800/80">
        <InlineSelect
          value={punto.estado}
          options={ESTADOS}
          onChange={(v) => cambiarEstado({ puntoId: punto.id, estado: v, actComudeId })}
          colorFn={colorEstado}
          disabled={!canManage}
        />
      </td>

      {/* VOTACIÓN */}
      <td className="px-2 py-2.5 w-32 text-center border-r border-zinc-200 dark:border-zinc-800/80">
        <InlineSelect
          value={punto.votacion}
          options={VOTACIONES}
          onChange={(v) => cambiarVotacion({ puntoId: punto.id, votacion: v, actComudeId })}
          colorFn={colorVotacion}
          disabled={!canManage}
        />
      </td>

      {/* CATEGORÍA */}
      <td
        onClick={() => canManage && onOpenCategoriasModal(punto.id)}
        className={cn(
          "px-3 py-2.5 w-36 border-r border-zinc-200 dark:border-zinc-800/80 text-center transition-colors select-none",
          canManage && "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
        )}
        title={canManage ? "Clic para cambiar categoría" : undefined}
      >
        <span className="text-xs text-foreground font-medium block truncate">
          {punto.categoria?.nombre ?? (canManage ? "Sin categoría" : "—")}
        </span>
      </td>

      {/* NOTAS */}
      {(sesionEstado !== "Programada" && sesionEstado != null) && (
        <td className="px-1 py-2.5 min-w-[280px] border-r border-zinc-200 dark:border-zinc-800/80">
          <div className="flex flex-col gap-2 w-full justify-start items-start">
            {punto.notas && punto.notas.length > 0 ? (
              <div className="w-full flex flex-col gap-1 max-h-24 overflow-y-auto custom-scrollbar pr-1" onClick={() => canManage && onOpenNotasModal(punto)}>
                {punto.notas.map((nota, index) => (
                  <div key={index} className={cn("w-full", canManage && "cursor-pointer group")}>
                    {punto.notas!.length > 1 && index > 0 && <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1 w-full"></div>}
                    <p className={cn("text-xs text-foreground/80 dark:text-zinc-300 font-normal leading-relaxed", canManage && "group-hover:text-foreground transition-colors")}>
                      {punto.notas!.length > 1 && <span className="font-semibold opacity-70 mr-1">{index + 1}.</span>}
                      {nota}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => canManage && onOpenNotasModal(punto)}
                className={cn(
                  "text-xs text-left w-full block text-muted-foreground italic",
                  canManage ? "cursor-pointer hover:underline" : "cursor-default"
                )}
              >
                {canManage ? "Añadir notas..." : "—"}
              </button>
            )}
          </div>
        </td>
      )}

      {/* ACTIVIDADES / ACUERDOS */}
      <td
        onClick={() => setIsActividadesModalOpen(true)}
        className={cn(
          "px-2 py-2.5 text-center w-36 align-middle cursor-pointer select-none group",
          canManage && "border-r border-zinc-200 dark:border-zinc-800/80"
        )}
        title={canManage ? "Clic para ver o asignar actividades" : "Clic para ver actividades"}
      >
        <div className="w-full h-full flex items-center justify-center">
          {totalActividades === 0 ? (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic transition-colors select-none group-hover:text-foreground dark:group-hover:text-zinc-200">
              Sin actividades
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 border shadow-2xs select-none w-full max-w-[130px] bg-emerald-50 text-emerald-700 border-emerald-300 group-hover:bg-emerald-100 group-hover:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 dark:group-hover:bg-emerald-900/60 dark:group-hover:border-emerald-700">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                {totalActividades} {totalActividades === 1 ? "actividad" : "actividades"}
              </span>
            </span>
          )}
        </div>
      </td>

      {/* ACCIONES */}
      {canManage && (
        <td className="p-0 w-14 text-center align-middle">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full h-full min-h-[44px] py-2.5 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors flex items-center justify-center cursor-pointer outline-none group"
                title="Acciones"
              >
                {eliminando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MoreVertical className="w-4 h-4 transition-transform group-hover:scale-110" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="left"
              align="center"
              sideOffset={8}
              className="w-36 z-[1100] shadow-none border-2 border-border bg-popover text-popover-foreground"
            >
              <DropdownMenuItem 
                onClick={() => { setEditando(true); setTituloEdit(punto.titulo); }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <Pencil className="mr-2 w-4 h-4 text-azul-trifinio" />
                <span>Editar</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleEliminar}
                disabled={eliminando}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 w-4 h-4" />
                <span>Eliminar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      )}
    </tr>
    <GestorArchivosPuntoModal
      isOpen={isArchivosModalOpen}
      onClose={() => setIsArchivosModalOpen(false)}
      punto={punto}
      actComudeId={actComudeId}
      municipioId={municipioId}
      canManage={canManage}
    />
    <ActividadesPuntoModal
      isOpen={isActividadesModalOpen}
      onClose={() => setIsActividadesModalOpen(false)}
      punto={punto}
      actComudeId={actComudeId}
      canManage={canManage}
    />
    </>
  );
}

// ─── Componente principal ───────────────────────────────────
interface TablaPuntosAgendaProps {
  puntos: ActComudePunto[];
  actComudeId: string;
  municipioId?: number | null;
  canManage: boolean;
  isAddModalOpen?: boolean;
  onCloseAddModal?: () => void;
  sesionEstado?: string | null;
  filtroEstado?: string | null;
}

export default function TablaPuntosAgenda({
  puntos,
  actComudeId,
  municipioId,
  canManage,
  isAddModalOpen,
  onCloseAddModal,
  sesionEstado,
  filtroEstado,
}: TablaPuntosAgendaProps) {
  const { data: puntosServidor } = usePuntosDeActividad(actComudeId);
  const puntosEfectivos = puntosServidor ?? puntos;
  const puntosFiltrados = filtroEstado ? puntosEfectivos.filter(p => (p.estado ?? "No iniciado") === filtroEstado) : puntosEfectivos;
  
  const [nuevoPunto, setNuevoPunto] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [busquedaCat, setBusquedaCat] = useState("");
  const [mostrarDropdownCat, setMostrarDropdownCat] = useState(false);
  const [categoriaModalTarget, setCategoriaModalTarget] = useState<string | null>(null);
  const [notasModalTarget, setNotasModalTarget] = useState<ActComudePunto | null>(null);

  const { data: categorias = [] } = useCategorias();
  const { mutateAsync: crearPunto, isPending: creando } = useCrearPunto(actComudeId);
  const { mutateAsync: actualizarPunto } = useActualizarPunto();
  const { mutateAsync: crearCategoria, isPending: creandoCat } = useCrearCategoria();

  const handleInlineCrearCategoria = async () => {
    if (!busquedaCat.trim()) return;
    try {
      const nuevaCat = await crearCategoria(busquedaCat.trim());
      setCategoriaNueva(nuevaCat.id);
      setBusquedaCat(nuevaCat.nombre);
      setMostrarDropdownCat(false);
      toast.success("Categoría creada");
    } catch (e) {
      toast.error("Error al crear la categoría");
    }
  };

  const handleSeleccionarCategoria = async (categoriaId: string | null) => {
    if (categoriaModalTarget === "NUEVO") {
      setCategoriaNueva(categoriaId ?? "");
    } else if (categoriaModalTarget) {
      try {
        await actualizarPunto({
          puntoId: categoriaModalTarget,
          values: { categoria_id: categoriaId },
          actComudeId
        });
      } catch (e) {
        toast.error("Error al actualizar la categoría del punto");
      }
    }
  };

  const handleAgregarPunto = async () => {
    const titulo = nuevoPunto.trim();
    if (!titulo || titulo.length < 3) {
      toast.warning("El título debe tener al menos 3 caracteres");
      return;
    }
    await crearPunto({
      titulo,
      categoria_id: categoriaNueva || null,
      estado: "No iniciado",
      votacion: "No emitido",
    });
    setNuevoPunto("");
    setCategoriaNueva("");
    setBusquedaCat("");
    if (onCloseAddModal) {
      onCloseAddModal();
    }
  };

  return (
    <div className="w-full">
      {/* Vista Desktop */}
      <div className="hidden md:block w-full overflow-x-auto border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700 text-foreground dark:text-zinc-200 bg-muted/40 dark:bg-zinc-900/80 font-semibold">
              <th className="px-2 py-2.5 text-center w-8 border-r border-zinc-300 dark:border-zinc-700/70">#</th>
              <th className="px-2 py-2.5 text-center w-12 border-r border-zinc-300 dark:border-zinc-700/70">DOCS</th>
              <th className="px-1 py-2.5 text-left w-[24%] min-w-[200px] max-w-[340px] border-r border-zinc-300 dark:border-zinc-700/70">PUNTO A TRATAR</th>
              <th className="px-2 py-2.5 text-center w-36 border-r border-zinc-300 dark:border-zinc-700/70">ESTADO</th>
              <th className="px-2 py-2.5 text-center w-32 border-r border-zinc-300 dark:border-zinc-700/70">VOTACIÓN</th>
              <th className="px-3 py-2.5 text-center w-36 border-r border-zinc-300 dark:border-zinc-700/70">CATEGORÍA</th>
              {(sesionEstado !== "Programada" && sesionEstado != null) && (
                <th className="px-1 py-2.5 text-left min-w-[280px] border-r border-zinc-300 dark:border-zinc-700/70">NOTAS</th>
              )}
              <th className={cn("px-2 py-2.5 text-center w-36", canManage && "border-r border-zinc-300 dark:border-zinc-700/70")}>ACTIVIDADES</th>
              {canManage && <th className="px-2 py-2.5 text-center w-16">ACCIONES</th>}
            </tr>
          </thead>
          <tbody>
            {puntosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7 + (sesionEstado !== "Programada" && sesionEstado != null ? 1 : 0) + (canManage ? 1 : 0)} className="text-center py-8 text-sm text-muted-foreground dark:text-gray-300 italic">
                  {filtroEstado ? "No hay puntos con este estado." : `No hay puntos de agenda. ${canManage ? "Agrega el primero abajo." : ""}`}
                </td>
              </tr>
            ) : (
              puntosFiltrados.map((punto, idx) => (
                <FilaPunto
                  key={punto.id}
                  punto={punto}
                  orden={idx + 1}
                  actComudeId={actComudeId}
                  municipioId={municipioId}
                  canManage={canManage}
                  categorias={categorias}
                  sesionEstado={sesionEstado}
                  isMobile={false}
                  onOpenCategoriasModal={setCategoriaModalTarget}
                  onOpenNotasModal={setNotasModalTarget}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Vista Mobile */}
      <div className="md:hidden flex flex-col gap-3">
        {puntosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground dark:text-gray-300 italic bg-muted/5 rounded-lg border border-border/50">
            {filtroEstado ? "No hay puntos con este estado." : `No hay puntos de agenda. ${canManage ? "Agrega el primero." : ""}`}
          </div>
        ) : (
          puntosFiltrados.map((punto, idx) => (
            <FilaPunto
              key={`mobile-${punto.id}`}
              punto={punto}
              orden={idx + 1}
              actComudeId={actComudeId}
              municipioId={municipioId}
              canManage={canManage}
              categorias={categorias}
              sesionEstado={sesionEstado}
              isMobile={true}
              onOpenCategoriasModal={setCategoriaModalTarget}
              onOpenNotasModal={setNotasModalTarget}
            />
          ))
        )}
      </div>

      {/* Modal para agregar nuevo punto */}
      {canManage && isAddModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <h3 className="font-bold text-lg text-foreground">Nuevo Punto a tratar</h3>
              <button
                onClick={onCloseAddModal}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-foreground/80">Título del punto</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Ej. Lectura del acta anterior..."
                  value={nuevoPunto}
                  onChange={(e) => setNuevoPunto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAgregarPunto(); } }}
                  className="w-full rounded-xl border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-azul-trifinio/50 bg-background"
                />
              </div>

              <div className="relative">
                <label className="text-sm font-semibold mb-1.5 block text-foreground/80">Categoría</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Buscar o crear categoría..."
                    value={busquedaCat}
                    onFocus={() => setMostrarDropdownCat(true)}
                    onBlur={() => setTimeout(() => setMostrarDropdownCat(false), 200)}
                    onChange={(e) => {
                      setBusquedaCat(e.target.value);
                      setMostrarDropdownCat(true);
                      setCategoriaNueva("");
                    }}
                    className="w-full rounded-xl border border-border/50 pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-azul-trifinio/50 bg-background"
                  />
                  {!categorias.some(c => c.nombre.toLowerCase() === busquedaCat.trim().toLowerCase()) && busquedaCat.trim().length > 0 && (
                    <button
                      onClick={handleInlineCrearCategoria}
                      disabled={creandoCat}
                      title="Crear categoría"
                      className="absolute right-2 text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 disabled:opacity-50 transition-colors bg-green-500/10 p-1 rounded-md"
                    >
                      {creandoCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  )}
                  {categorias.some(c => c.nombre.toLowerCase() === busquedaCat.trim().toLowerCase()) && (
                    <ChevronDown className="absolute right-3 w-4 h-4 opacity-40 pointer-events-none" />
                  )}
                </div>

                {/* Dropdown Options */}
                {mostrarDropdownCat && (
                  <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#222] border border-border/50 rounded-xl shadow-xl py-1 custom-scrollbar">
                    <li
                      onClick={() => {
                        setCategoriaNueva("");
                        setBusquedaCat("");
                        setMostrarDropdownCat(false);
                      }}
                      className="px-4 py-2 text-sm text-muted-foreground italic hover:bg-muted/50 cursor-pointer"
                    >
                      Sin categoría
                    </li>
                    {categorias
                      .filter(c => c.nombre.toLowerCase().includes(busquedaCat.toLowerCase()))
                      .map(c => (
                        <li
                          key={c.id}
                          onClick={() => {
                            setCategoriaNueva(c.id);
                            setBusquedaCat(c.nombre);
                            setMostrarDropdownCat(false);
                          }}
                          className="px-4 py-2 text-sm text-foreground hover:bg-muted/50 cursor-pointer"
                        >
                          {c.nombre}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={onCloseAddModal}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarPunto}
                disabled={!nuevoPunto.trim() || creando}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {creando && <Loader2 className="w-4 h-4 animate-spin" />}
                Agregar punto
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Categorías */}
      <CategoriasModal
        isOpen={!!categoriaModalTarget}
        onClose={() => setCategoriaModalTarget(null)}
        onSelectCategoria={handleSeleccionarCategoria}
        selectedCategoriaId={categoriaModalTarget ? (puntos.find(p => p.id === categoriaModalTarget)?.categoria_id ?? null) : undefined}
      />

      {/* Modal de Notas */}
      {notasModalTarget && (
        <NotasModal
          isOpen={!!notasModalTarget}
          onClose={() => setNotasModalTarget(null)}
          puntoId={notasModalTarget.id}
          actComudeId={actComudeId}
          notasIniciales={notasModalTarget.notas}
          canManage={canManage}
        />
      )}
    </div>
  );
}
