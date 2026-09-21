"use client";

import { useRef, useState, useEffect } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { FileText, Loader2, Trash2, Eye, Upload } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ModalShell } from "@/components/ui/general-modal";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {
  useAgregarAcreditacionPuesto,
  useEliminarAcreditacionPuesto,
  usePuestos,
} from "../lib/hooks";
import type { AcreditacionFile } from "../lib/zod";
import { modalActionMessage } from "./EstructuraFormShell";

const ActaVisorModal = dynamic(
  () => import("@/components/(comude)/actividades/modals/ActaVisorModal"),
  { ssr: false }
);

export function GestorAcreditacionesModal({
  open,
  onOpenChange,
  puestoId,
  puestoNombre,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puestoId: string | null;
  puestoNombre: string;
}) {
  const { data: puestos = [] } = usePuestos();
  const agregarMutation = useAgregarAcreditacionPuesto();
  const eliminarMutation = useEliminarAcreditacionPuesto();

  const [subiendo, setSubiendo] = useState(false);
  const [generandoUrlId, setGenerandoUrlId] = useState<string | null>(null);
  const [actaUrlToView, setActaUrlToView] = useState<string | null>(null);
  const [pdfViendoNombre, setPdfViendoNombre] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const puestoActual = puestos.find((p) => p.id === puestoId);
  const acreditaciones: AcreditacionFile[] = puestoActual?.acreditaciones ?? [];

  useEffect(() => {
    if (!open) {
      setActaUrlToView(null);
    }
  }, [open]);

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !puestoId) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.warn("El archivo debe ser en formato PDF.");
      return;
    }

    setSubiendo(true);
    try {
      const supabase = createClient();
      const fileNameSeguro = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = `puestos/${puestoId}/${Date.now()}_${fileNameSeguro}`;

      const { error: uploadError } = await supabase.storage
        .from("acreditaciones")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const res = await agregarMutation.mutateAsync({
        puestoId,
        nombre: file.name,
        filePath,
      });

      if (res.success) {
        toast.success("Acreditación agregada correctamente.");
      } else {
        toast.error(modalActionMessage(res.error ?? undefined, "No se pudo guardar la acreditación."));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al subir la acreditación.");
    } finally {
      setSubiendo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAbrirPdf = async (archivo: AcreditacionFile) => {
    setGenerandoUrlId(archivo.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("acreditaciones")
        .createSignedUrl(archivo.file_path, 3600);

      if (error || !data?.signedUrl) {
        const { data: publicData } = supabase.storage
          .from("acreditaciones")
          .getPublicUrl(archivo.file_path);
        if (publicData?.publicUrl) {
          setPdfViendoNombre(archivo.nombre);
          setActaUrlToView(publicData.publicUrl);
          return;
        }
        toast.error("No se pudo obtener la URL de la acreditación.");
        return;
      }

      setPdfViendoNombre(archivo.nombre);
      setActaUrlToView(data.signedUrl);
    } catch {
      toast.error("Error al abrir la acreditación.");
    } finally {
      setGenerandoUrlId(null);
    }
  };

  const handleEliminar = async (archivo: AcreditacionFile) => {
    if (!puestoId) return;

    const result = await Swal.fire({
      title: "¿Eliminar acreditación?",
      text: `Se eliminará "${archivo.nombre}". Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const supabase = createClient();
      await supabase.storage.from("acreditaciones").remove([archivo.file_path]);

      const res = await eliminarMutation.mutateAsync({
        puestoId,
        archivoId: archivo.id,
      });

      if (res.success) {
        toast.success("Acreditación eliminada.");
        if (actaUrlToView) {
          setActaUrlToView(null);
        }
      } else {
        toast.error(modalActionMessage(res.error ?? undefined, "No se pudo eliminar la acreditación."));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la acreditación.");
    }
  };

  return (
    <>
      <ModalShell
        open={open && !actaUrlToView}
        onClose={() => onOpenChange(false)}
        title="Acreditaciones del Puesto"
        subtitle={puestoNombre}
        className="max-w-md w-full"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Acreditaciones cargadas ({acreditaciones.length})
          </span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 mb-4">
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60">
            {acreditaciones.length === 0 ? (
              <li className="p-5 text-center text-xs text-muted-foreground italic">
                Este puesto aún no tiene acreditaciones adjuntas.
              </li>
            ) : (
              acreditaciones.map((archivo) => (
                <li
                  key={archivo.id}
                  className="flex items-center justify-between gap-2 p-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                        {archivo.nombre}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(archivo.created_at || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAbrirPdf(archivo)}
                      disabled={generandoUrlId === archivo.id}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400 disabled:opacity-50"
                      title="Ver acreditación"
                    >
                      {generandoUrlId === archivo.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminar(archivo)}
                      disabled={eliminarMutation.isPending}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50"
                      title="Eliminar acreditación"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="mb-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,application/pdf"
            onChange={handleSubirArchivo}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-70 cursor-pointer"
          >
            {subiendo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {subiendo ? "Subiendo acreditación..." : "Subir nueva acreditación"}
          </button>
        </div>

        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl text-xs font-semibold h-8"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
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

