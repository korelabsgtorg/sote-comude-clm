"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Trash2, FileText, Loader2, ExternalLink, Eye, Link as LinkIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { ActComudePunto } from "../lib/zod";
import { useCrearArchivoPunto, useEliminarArchivoPunto } from "../lib/hooks";

import { ModalShell, ModalFooter } from "@/components/ui/general-modal";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const ActaVisorModal = dynamic(() => import("./ActaVisorModal"), { ssr: false });

interface GestorArchivosPuntoModalProps {
  isOpen: boolean;
  onClose: () => void;
  punto: ActComudePunto;
  actComudeId: string;
  canManage: boolean;
}

export default function GestorArchivosPuntoModal({
  isOpen,
  onClose,
  punto,
  actComudeId,
  canManage,
}: GestorArchivosPuntoModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [actaUrlToView, setActaUrlToView] = useState<string | null>(null);
  const [pdfViendoNombre, setPdfViendoNombre] = useState<string>("");
  const [isGenerandoUrl, setIsGenerandoUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: crearArchivo } = useCrearArchivoPunto();
  const { mutateAsync: eliminarArchivo, isPending: eliminando } = useEliminarArchivoPunto();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) {
      setActaUrlToView(null);
    }
  }, [isOpen]);

  if (!mounted) return null;

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileNameSeguro = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${actComudeId}/puntos/${punto.id}/${Date.now()}_${fileNameSeguro}`;

      const { error: uploadError } = await supabase.storage.from("actas").upload(filePath, file);
      if (uploadError) throw uploadError;

      await crearArchivo({
        puntoId: punto.id,
        nombre: file.name,
        filePath: filePath,
        actComudeId,
      });

      toast.success("Archivo subido exitosamente");
    } catch (err) {
      toast.error("Error al subir el archivo");
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEliminar = async (archivoId: string, filePath: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar archivo?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const supabase = createClient();
        await supabase.storage.from("actas").remove([filePath]);
        await eliminarArchivo({ archivoId, actComudeId });
        toast.success("Archivo eliminado");
      } catch (err) {
        toast.error("Error al eliminar el archivo");
      }
    }
  };

  const archivos = punto.act_comude_archivos || [];

  return (
    <>
      <ModalShell
        open={isOpen && !actaUrlToView}
        onClose={onClose}
        title="Documentos adjuntos"
        subtitle={punto.titulo}
        className="max-w-md w-full"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Documentos adjuntos ({archivos.length})
          </span>
        </div>
        
        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 mb-4">
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60">
            {archivos.length === 0 ? (
              <li className="p-5 text-center text-xs text-muted-foreground italic">
                No hay documentos adjuntos.
              </li>
            ) : (
              archivos.map((archivo) => {
                const isPdf = archivo.nombre.toLowerCase().endsWith('.pdf');
                return (
                  <li
                    key={archivo.id}
                    className="flex items-center justify-between gap-2 p-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isPdf
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}
                      >
                        {isPdf ? <FileText size={16} /> : <LinkIcon size={16} />}
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
                      {isPdf ? (
                        <button
                          type="button"
                          onClick={async () => {
                            setIsGenerandoUrl(archivo.id);
                            try {
                              const supabase = createClient();
                              const { data, error } = await supabase.storage.from("actas").createSignedUrl(archivo.file_path, 3600);
                              if (error || !data) throw error;
                              setPdfViendoNombre(archivo.nombre);
                              setActaUrlToView(data.signedUrl);
                            } catch (e) {
                              toast.error("Error al cargar el PDF");
                            } finally {
                              setIsGenerandoUrl(null);
                            }
                          }}
                          disabled={isGenerandoUrl === archivo.id}
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400 disabled:opacity-50"
                          title="Ver documento"
                        >
                          {isGenerandoUrl === archivo.id ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const supabase = createClient();
                              const { data, error } = await supabase.storage.from("actas").createSignedUrl(archivo.file_path, 3600);
                              if (error || !data) throw error;
                              window.open(data.signedUrl, '_blank');
                            } catch (e) {
                              toast.error("Error al descargar el archivo");
                            }
                          }}
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                          title="Abrir archivo"
                        >
                          <ExternalLink size={15} />
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => handleEliminar(archivo.id, archivo.file_path)}
                          disabled={eliminando}
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Eliminar archivo"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {canManage && (
          <div className="mb-2">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleSubirArchivo}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-70"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isUploading ? "Subiendo archivo..." : "Subir nuevo archivo"}
            </button>
          </div>
        )}

        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full rounded-xl text-xs font-semibold h-8" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </ModalShell>

      <ActaVisorModal
        isOpen={!!actaUrlToView}
        onClose={() => setActaUrlToView(null)}
        actaUrl={actaUrlToView || ''}
        actividadNombre={pdfViendoNombre}
      />
    </>
  );
}
