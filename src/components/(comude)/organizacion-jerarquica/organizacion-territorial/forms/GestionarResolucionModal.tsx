"use client";

import { useState, useRef } from "react";
import { toast } from "react-toastify";
import dynamic from "next/dynamic";
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  Download,
  History,
  Plus,
  ArrowRight,
  ShieldCheck,
  User,
  Trash2,
  Eye,
  Loader2,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/general-modal";
import { Button } from "@/components/ui/button";
import { FormLabel } from "./TerritorioFormShell";
import {
  useResolucionVigente,
  useHistorialResoluciones,
  useRenovarResolucion,
  useEditarResolucion,
} from "../lib/hooks";
import type { CocodePeriodo, PeriodoConHistorico, CocodeResolucionFileItem } from "../lib/zod";
import { createClient } from "@/utils/supabase/client";

const ActaVisorModal = dynamic(
  () => import("@/components/(comude)/actividades/modals/ActaVisorModal"),
  { ssr: false }
);

function formatFecha(fechaStr: string | null | undefined) {
  if (!fechaStr) return "N/A";
  try {
    const d = new Date(fechaStr);
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    const diaNombre = dias[d.getUTCDay() !== undefined ? d.getUTCDay() : d.getDay()];
    const diaNum = d.getUTCDate();
    const mesNombre = meses[d.getUTCMonth()];
    const anio = d.getUTCFullYear();
    
    return `${diaNombre} ${diaNum} De ${mesNombre}, ${anio}`;
  } catch {
    return fechaStr;
  }
}

function BadgeVigencia({ periodo }: { periodo: CocodePeriodo | null | undefined }) {
  if (!periodo || !periodo.estado_vigencia) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 shrink-0 rounded-lg bg-zinc-500/10 px-2.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
        <Clock className="size-3 shrink-0" /> Sin Resolución
      </span>
    );
  }

  const { estado_vigencia: estado, dias_restantes: dias } = periodo;

  if (estado === "vencido") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 shrink-0 rounded-lg bg-red-500/15 px-2.5 text-[11px] font-semibold text-red-700 dark:text-red-300 whitespace-nowrap">
        <XCircle className="size-3 shrink-0" /> Vencido ({Math.abs(dias ?? 0)}d)
      </span>
    );
  }

  if (estado === "por_vencer") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 shrink-0 rounded-lg bg-amber-500/15 px-2.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
        <AlertTriangle className="size-3 shrink-0" /> Por Vencer ({dias}d)
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 items-center gap-1.5 shrink-0 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
      <CheckCircle2 className="size-3 shrink-0" />
      <span className="sm:hidden">Vigente ({dias}d)</span>
      <span className="hidden sm:inline">Vigente ({dias} Días Restantes)</span>
    </span>
  );
}

export function GestionarResolucionModal({
  open,
  onOpenChange,
  comunidadId,
  comunidadNombre,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comunidadId: string | null;
  comunidadNombre: string;
}) {
  const [activeTab, setActiveTab] = useState<"actual" | "renovar" | "historial">("actual");

  // Form State para renovar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [limpiarPuestos, setLimpiarPuestos] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Edit State para resolución vigente
  const [isEditing, setIsEditing] = useState(false);
  const [editTitulo, setEditTitulo] = useState("");
  const [editFechaEmision, setEditFechaEmision] = useState("");
  const [editFechaVencimiento, setEditFechaVencimiento] = useState("");
  const [editArchivosExistentes, setEditArchivosExistentes] = useState<CocodeResolucionFileItem[]>([]);
  const [editNuevosArchivos, setEditNuevosArchivos] = useState<File[]>([]);

  // Visor PDF state
  const [actaUrlToView, setActaUrlToView] = useState<string | null>(null);
  const [pdfViendoNombre, setPdfViendoNombre] = useState<string>("");
  const [generandoUrlId, setGenerandoUrlId] = useState<string | null>(null);

  const { data: resolucionRes, isLoading: loadingVigente } = useResolucionVigente(
    open ? comunidadId : null
  );
  const { data: historialRes, isLoading: loadingHistorial } = useHistorialResoluciones(
    open ? comunidadId : null
  );
  const renovarMutation = useRenovarResolucion();
  const editarMutation = useEditarResolucion();

  const periodoVigente = resolucionRes?.data as CocodePeriodo | null;
  const historialRaw = (historialRes?.data ?? []) as PeriodoConHistorico[];
  const historial = historialRaw.filter(
    (item) => !item.activo && item.id !== periodoVigente?.id
  );

  const resetForm = () => {
    setTitulo("");
    setFiles([]);
    setFechaEmision("");
    setFechaVencimiento("");
    setLimpiarPuestos(true);
    setUploading(false);
    setIsEditing(false);
    setEditArchivosExistentes([]);
    setEditNuevosArchivos([]);
  };

  const handleIniciarEdicion = () => {
    if (!periodoVigente) return;
    setEditTitulo(periodoVigente.resolucion?.titulo || "");
    setEditFechaEmision(
      periodoVigente.fecha_emision ? periodoVigente.fecha_emision.slice(0, 10) : ""
    );
    setEditFechaVencimiento(
      periodoVigente.fecha_vencimiento ? periodoVigente.fecha_vencimiento.slice(0, 10) : ""
    );
    setEditArchivosExistentes(periodoVigente.resolucion?.archivos || []);
    setEditNuevosArchivos([]);
    setIsEditing(true);
  };

  const handleAddEditFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setEditNuevosArchivos((prev) => [...prev, ...newFiles]);
    }
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleRemoveEditNuevoFile = (index: number) => {
    setEditNuevosArchivos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveEditExistenteFile = (id: string) => {
    setEditArchivosExistentes((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodoVigente?.id) return;
    if (!editTitulo.trim()) {
      toast.error("Ingresa el título o número de la resolución.");
      return;
    }
    if (!editFechaVencimiento) {
      toast.error("Selecciona la fecha de vencimiento.");
      return;
    }

    try {
      setUploading(true);
      const nuevosSubidos: Array<{ id: string; nombre: string; file_path: string }> = [];
      const supabase = createClient();

      for (let i = 0; i < editNuevosArchivos.length; i++) {
        const f = editNuevosArchivos[i];
        const fileNameSeguro = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const filePath = `cocode/resoluciones/${comunidadId}/${Date.now()}_edit_${i}_${fileNameSeguro}`;

        const { error: uploadErr } = await supabase.storage
          .from("acreditaciones")
          .upload(filePath, f, { upsert: true });

        if (uploadErr) {
          toast.error(`Error al subir el archivo ${f.name}`);
          setUploading(false);
          return;
        }

        nuevosSubidos.push({
          id: `${Date.now()}_edit_${i}`,
          nombre: f.name,
          file_path: filePath,
        });
      }

      const listaFinalArchivos = [
        ...editArchivosExistentes,
        ...nuevosSubidos,
      ];

      const res = await editarMutation.mutateAsync({
        periodoId: periodoVigente.id,
        titulo: editTitulo.trim(),
        archivos: listaFinalArchivos,
        fechaEmision: editFechaEmision ? new Date(editFechaEmision).toISOString() : null,
        fechaVencimiento: new Date(editFechaVencimiento).toISOString(),
      });

      if (res.success) {
        toast.success("¡Resolución actualizada con éxito!");
        setIsEditing(false);
      } else {
        toast.error("Error al actualizar la resolución.");
      }
    } catch {
      toast.error("Ocurrió un error al guardar los cambios.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRenovarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comunidadId) return;
    if (!titulo.trim()) {
      toast.error("Ingresa el título o número de la resolución.");
      return;
    }
    if (!fechaVencimiento) {
      toast.error("Selecciona la fecha de vencimiento.");
      return;
    }

    try {
      setUploading(true);
      const subidos: Array<{ nombre: string; filePath: string }> = [];
      const supabase = createClient();

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const fileExt = f.name.split(".").pop();
        const fileNameSeguro = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        // Estructura ofuscada: cocode/resoluciones/{comunidadId}/{timestamp}_{filename}
        const filePath = `cocode/resoluciones/${comunidadId}/${Date.now()}_${i}_${fileNameSeguro}`;

        const { error: uploadErr } = await supabase.storage
          .from("acreditaciones")
          .upload(filePath, f, { upsert: true });

        if (uploadErr) {
          toast.error(`Error al subir el archivo ${f.name}`);
          setUploading(false);
          return;
        }

        subidos.push({
          nombre: f.name,
          filePath,
        });
      }

      const res = await renovarMutation.mutateAsync({
        comunidadId,
        titulo: titulo.trim(),
        archivos: subidos,
        fechaEmision: fechaEmision ? new Date(fechaEmision).toISOString() : null,
        fechaVencimiento: new Date(fechaVencimiento).toISOString(),
        limpiarPuestosActuales: limpiarPuestos,
      });

      if (res.success) {
        toast.success("¡Resolución registrada con éxito!");
        resetForm();
        setActiveTab("actual");
      } else {
        toast.error("Error al guardar la resolución.");
      }
    } catch {
      toast.error("Ocurrió un error al procesar.");
    } finally {
      setUploading(false);
    }
  };

  const handleAbrirPdf = async (archivo: { id?: string; nombre: string; file_path: string }) => {
    if (!archivo.file_path) {
      toast.info("Esta resolución no tiene un archivo adjunto disponible.");
      return;
    }

    try {
      if (archivo.id) setGenerandoUrlId(archivo.id);
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("acreditaciones")
        .createSignedUrl(archivo.file_path, 3600);

      let finalUrl = data?.signedUrl;

      if (error || !finalUrl) {
        const publicRes = supabase.storage
          .from("acreditaciones")
          .getPublicUrl(archivo.file_path);
        finalUrl = publicRes.data.publicUrl;
      }

      if (!finalUrl) {
        toast.error("No se pudo obtener el enlace de lectura del archivo.");
        return;
      }

      setPdfViendoNombre(archivo.nombre);
      setActaUrlToView(finalUrl);
    } catch (err) {
      console.error(err);
      toast.error("Error al obtener la URL del archivo.");
    } finally {
      setGenerandoUrlId(null);
    }
  };

  const handleDescargarFile = async (path: string) => {
    if (!path) {
      toast.info("Esta resolución no tiene archivo adjunto.");
      return;
    }
    try {
      const supabase = createClient();
      const { data } = supabase.storage.from("acreditaciones").getPublicUrl(path);
      if (data?.publicUrl) {
        window.open(data.publicUrl, "_blank");
      }
    } catch {
      toast.error("No se pudo obtener el archivo.");
    }
  };

  return (
    <>
      <ModalShell
        open={open && !actaUrlToView}
        onClose={() => onOpenChange(false)}
        title={`Resolución - ${comunidadNombre}`}
        className="max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-4xl w-full"
        contentClassName="px-2 sm:px-4"
        headerExtra={
          periodoVigente && !isEditing ? (
            <button
              type="button"
              onClick={handleIniciarEdicion}
              title="Editar Resolución"
              className="flex size-7 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              <Pencil className="size-3.5" />
              <span className="sr-only">Editar</span>
            </button>
          ) : null
        }
      >
        <div className="w-full space-y-2">
          <div className="flex items-center justify-center gap-6 border-b border-border/60 px-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("actual")}
              className={cn(
                "flex items-center gap-2 py-1.5 font-semibold transition-all relative border-b-2 cursor-pointer -mb-px",
                activeTab === "actual" || activeTab === "renovar"
                  ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="size-4" /> {periodoVigente ? "Resolución Vigente" : "Cargar Resolución"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("historial")}
              className={cn(
                "flex items-center gap-2 py-1.5 font-semibold transition-all relative border-b-2 cursor-pointer -mb-px",
                activeTab === "historial"
                  ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="size-4" /> Historial ({historial.length})
            </button>
          </div>

          {/* TAB 1: RESOLUCIÓN ACTUAL / CARGAR */}
          {activeTab === "actual" && (
            <div className="space-y-3 pt-0">
              {loadingVigente ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cargando resolución vigente...
                </div>
              ) : !periodoVigente ? (
                /* Muestra formulario directamente si no hay resolución */
                <form onSubmit={handleRenovarSubmit} className="space-y-4">
                  <div className="rounded-lg border border-purple-500/40 bg-transparent px-3 py-2 text-[11px] text-purple-800 dark:text-purple-300">
                    <p className="font-semibold">
                      Esta comunidad aún no cuenta con una resolución registrada. Completa los datos para registrar su primer período COCODE.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <FormLabel htmlFor="titulo">Título o Número de Resolución *</FormLabel>
                    <input
                      id="titulo"
                      type="text"
                      required
                      placeholder="Ej: Resolución Municipal No. 04-2024"
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <FormLabel htmlFor="fechaEmision" className="truncate block">Fecha de Emisión</FormLabel>
                      <input
                        id="fechaEmision"
                        type="date"
                        className="w-full min-w-0 rounded-xl border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                        value={fechaEmision}
                        onChange={(e) => setFechaEmision(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <FormLabel htmlFor="fechaVencimiento" className="truncate block">Fecha Vencimiento *</FormLabel>
                      <input
                        id="fechaVencimiento"
                        type="date"
                        required
                        className="w-full min-w-0 rounded-xl border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                        value={fechaVencimiento}
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>Archivos PDF de la Resolución ({files.length})</FormLabel>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,application/pdf"
                      multiple
                      className="hidden"
                      onChange={handleAddFiles}
                    />

                    {files.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {files.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-xl border bg-card p-2.5 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                <FileText className="size-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">
                                  {f.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {(f.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(idx)}
                              className="size-7 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-3 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                    >
                      <Upload className="size-4" /> {files.length > 0 ? "Agregar otro archivo PDF" : "Subir archivos de resolución"}
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={uploading || renovarMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {uploading || renovarMutation.isPending ? "Guardando..." : "Guardar Resolución"}
                    </Button>
                  </div>
                </form>
              ) : isEditing ? (
                /* FORMULARIO PARA EDITAR LA RESOLUCIÓN VIGENTE */
                <form onSubmit={handleEditarSubmit} className="space-y-4">
                  <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-300">
                    <p className="font-semibold">
                      Modificando los datos de la resolución vigente. Al guardar no se creará un nuevo período ni se desasignarán directivas.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <FormLabel htmlFor="editTitulo">Título o Número de Resolución *</FormLabel>
                    <input
                      id="editTitulo"
                      type="text"
                      required
                      placeholder="Ej: Resolución Municipal No. 04-2024"
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={editTitulo}
                      onChange={(e) => setEditTitulo(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <FormLabel htmlFor="editFechaEmision" className="truncate block">Fecha de Emisión</FormLabel>
                      <input
                        id="editFechaEmision"
                        type="date"
                        className="w-full min-w-0 rounded-xl border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                        value={editFechaEmision}
                        onChange={(e) => setEditFechaEmision(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <FormLabel htmlFor="editFechaVencimiento" className="truncate block">Fecha Vencimiento *</FormLabel>
                      <input
                        id="editFechaVencimiento"
                        type="date"
                        required
                        className="w-full min-w-0 rounded-xl border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                        value={editFechaVencimiento}
                        onChange={(e) => setEditFechaVencimiento(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FormLabel>Archivos PDF de la Resolución</FormLabel>
                    
                    {/* Archivos ya existentes */}
                    {editArchivosExistentes.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Archivos Guardados:</span>
                        {editArchivosExistentes.map((arc) => (
                          <div key={arc.id} className="flex items-center justify-between rounded-xl border bg-card p-2.5 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                <FileText className="size-3.5" />
                              </div>
                              <span className="truncate font-semibold text-foreground">{arc.nombre}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEditExistenteFile(arc.id)}
                              className="size-7 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Quitar archivo"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Nuevos archivos a agregar */}
                    {editNuevosArchivos.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Nuevos Archivos a Agregar:</span>
                        {editNuevosArchivos.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-xl border bg-card p-2.5 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                                <FileText className="size-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{f.name}</p>
                                <p className="text-[10px] text-muted-foreground">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEditNuevoFile(idx)}
                              className="size-7 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept=".pdf,application/pdf"
                      multiple
                      className="hidden"
                      onChange={handleAddEditFiles}
                    />

                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-500/50 hover:bg-purple-500/5 px-4 py-3 text-xs font-semibold text-purple-700 dark:text-purple-300 transition-colors cursor-pointer"
                    >
                      <Upload className="size-4" /> Agregar otro archivo PDF
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={uploading || editarMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {uploading || editarMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  {/* Tarjeta principal reactiva y compacta */}
                  <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-card to-muted/20 p-2.5 sm:p-3.5 dark:border-zinc-800/80 space-y-3 shadow-sm">
                    {/* Fila Superior: Badge + Renovar COCODE */}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0 shrink">
                        <BadgeVigencia periodo={periodoVigente} />
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-2.5 text-[11px] font-semibold text-white transition-all hover:bg-purple-700 shrink-0 shadow-sm whitespace-nowrap"
                        onClick={() => setActiveTab("renovar")}
                      >
                        Renovar COCODE <ArrowRight className="size-3 shrink-0" />
                      </button>
                    </div>

                    {/* Título de la Resolución */}
                    <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800/80 pt-3">
                      <div className="block sm:flex sm:items-center sm:gap-2 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/80 shrink-0 block sm:inline">
                          Título / Número de Resolución <span className="hidden sm:inline text-muted-foreground/50 font-normal">|</span>
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-snug truncate">
                          {periodoVigente.resolucion?.titulo || "Sin título"}
                        </h4>
                      </div>
                    </div>

                    {/* Grid de Fechas a la par (en una sola fila junto a su texto) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="flex items-center justify-between rounded-xl bg-background/80 border px-3.5 py-3 text-left">
                        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Calendar className="size-3.5" />
                          </div>
                          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                            Fecha Emisión:
                          </span>
                        </div>
                        <p className="font-extrabold text-foreground text-xs sm:text-sm tracking-tight truncate ml-2">
                          {formatFecha(periodoVigente.fecha_emision)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-background/80 border px-3.5 py-3 text-left">
                        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Clock className="size-3.5" />
                          </div>
                          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                            Fecha Vencimiento:
                          </span>
                        </div>
                        <p className="font-extrabold text-foreground text-xs sm:text-sm tracking-tight truncate ml-2">
                          {formatFecha(periodoVigente.fecha_vencimiento)}
                        </p>
                      </div>
                    </div>

                    {/* Archivos Adjuntos */}
                    {periodoVigente.resolucion?.archivos && periodoVigente.resolucion.archivos.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/80 block mb-1.5">
                          Archivos Adjuntos ({periodoVigente.resolucion.archivos.length})
                        </span>
                        <div className="space-y-1.5">
                          {periodoVigente.resolucion.archivos.map((arc) => (
                            <div
                              key={arc.id}
                              className="flex items-center justify-between gap-2 rounded-xl border bg-background/60 p-2 text-xs hover:border-purple-500/30 transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                                  <FileText className="size-3.5" />
                                </div>
                                <span className="font-medium text-foreground truncate">{arc.nombre}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={generandoUrlId === arc.id}
                                  onClick={() => handleAbrirPdf(arc)}
                                  className="size-7 p-0 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                                  title="Ver PDF"
                                >
                                  {generandoUrlId === arc.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Eye className="size-3.5" />
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDescargarFile(arc.file_path)}
                                  className="size-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                                  title="Descargar PDF"
                                >
                                  <Download className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RENOVAR / CARGAR NUEVA */}
          {activeTab === "renovar" && (
            <div className="space-y-3 pt-0">
              <form onSubmit={handleRenovarSubmit} className="space-y-3">
                {periodoVigente && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="font-medium leading-tight">
                      <span className="font-bold">Nota:</span> Al registrar una nueva resolución, la vigente y su directiva pasarán al historial.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <FormLabel htmlFor="titulo">Título o Número de Resolución *</FormLabel>
                  <input
                    id="titulo"
                    type="text"
                    required
                    placeholder="Ej: Resolución Municipal No. 04-2024"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <FormLabel htmlFor="fechaEmision" className="truncate block">Fecha de Emisión</FormLabel>
                    <input
                      id="fechaEmision"
                      type="date"
                      className="w-full min-w-0 rounded-xl border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                      value={fechaEmision}
                      onChange={(e) => setFechaEmision(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <FormLabel htmlFor="fechaVencimiento" className="truncate block">Fecha Vencimiento *</FormLabel>
                    <input
                      id="fechaVencimiento"
                      type="date"
                      required
                      className="w-full min-w-0 rounded-xl border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Archivos PDF de la Resolución ({files.length})</FormLabel>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleAddFiles}
                  />

                  {files.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {files.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-xl border bg-card p-2.5 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                              <FileText className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {f.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {(f.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(idx)}
                            className="size-7 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Quitar de la lista"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-3 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload className="size-4" /> {files.length > 0 ? "Agregar otro archivo PDF" : "Subir archivos de resolución"}
                  </button>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded accent-purple-600 mt-0.5"
                    checked={limpiarPuestos}
                    onChange={(e) => setLimpiarPuestos(e.target.checked)}
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">
                      Desasignar integrantes actuales para el nuevo período
                    </span>
                    <p className="text-muted-foreground">
                      Mantiene los puestos de la comunidad vacíos listos para asignar a la nueva directiva.
                    </p>
                  </div>
                </label>

                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("actual")}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={uploading || renovarMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {uploading || renovarMutation.isPending ? "Guardando..." : "Guardar Resolución"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: HISTORIAL */}
          {activeTab === "historial" && (
            <div className="space-y-3 pt-1">
              {loadingHistorial ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cargando historial...
                </div>
              ) : historial.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No hay resoluciones registradas en el historial.
                </div>
              ) : (
                <div className="space-y-3">
                  {historial.map((item) => (
                    <div key={item.id} className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {item.resolucion?.titulo || "Sin título"}
                            </span>
                            {!item.activo && (
                              <span className="rounded-md bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                                Histórico
                              </span>
                            )}
                            {item.activo && <BadgeVigencia periodo={item} />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Vencimiento: {formatFecha(item.fecha_vencimiento)}
                          </p>
                        </div>
                      </div>

                      {item.resolucion?.archivos && item.resolucion.archivos.length > 0 && (
                        <div className="border-t pt-2 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Archivos Adjuntos ({item.resolucion.archivos.length})
                          </span>
                          <div className="space-y-1">
                            {item.resolucion.archivos.map((arc) => (
                              <div key={arc.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="size-3.5 text-purple-600 shrink-0" />
                                  <span className="font-medium text-foreground truncate">{arc.nombre}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={generandoUrlId === arc.id}
                                    onClick={() => handleAbrirPdf(arc)}
                                    className="size-7 p-0 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
                                    title="Ver archivo PDF"
                                  >
                                    {generandoUrlId === arc.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Eye className="size-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDescargarFile(arc.file_path)}
                                    className="size-7 p-0 text-muted-foreground hover:text-foreground"
                                    title="Descargar PDF"
                                  >
                                    <Download className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.historico_puestos && item.historico_puestos.length > 0 && (
                        <div className="border-t pt-2 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Directiva de este Período ({item.historico_puestos.length} integrantes)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {item.historico_puestos.map((p) => (
                              <div key={p.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                                <User className="size-3.5 text-muted-foreground shrink-0" />
                                <div className="truncate">
                                  <span className="font-semibold text-foreground">{p.nombre_puesto}: </span>
                                  <span className="text-muted-foreground">
                                    {p.titular_nombre || "Sin persona"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ModalShell>

      <ActaVisorModal
        isOpen={!!actaUrlToView}
        onClose={() => setActaUrlToView(null)}
        actaUrl={actaUrlToView || ""}
        actividadNombre={pdfViendoNombre}
      />
    </>
  );
}
