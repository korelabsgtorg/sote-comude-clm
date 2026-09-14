'use client';

import { useEffect, useState } from 'react';
import type { ArchivoAdjunto } from '@/components/tareas/types';
import VerPDF from '@/components/files/verPDF';
import {
  ModalCancel,
  ModalFooter,
  ModalShell,
} from '@/components/ui/general-modal';
import { ExternalLink, Eye, FileText, Link as LinkIcon } from 'lucide-react';

const BUCKET_ARCHIVOS_ACTIVIDADES = 'archivos_actividades';

type ArchivosActividadModalProps = {
  open: boolean;
  onClose: () => void;
  tituloActividad: string;
  archivos: ArchivoAdjunto[];
};

export default function ArchivosActividadModal({
  open,
  onClose,
  tituloActividad,
  archivos,
}: ArchivosActividadModalProps) {
  const [pdfViendo, setPdfViendo] = useState<ArchivoAdjunto | null>(null);

  useEffect(() => {
    if (!open) {
      setPdfViendo(null);
    }
  }, [open]);

  return (
    <>
      <ModalShell
        open={open && !pdfViendo}
        onClose={onClose}
        title="Archivos cargados"
        subtitle={tituloActividad}
        footer={
          <ModalFooter>
            <ModalCancel onClick={onClose}>Cerrar</ModalCancel>
          </ModalFooter>
        }
      >
        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
          {archivos.map((archivo) => (
            <li
              key={archivo.id}
              className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    archivo.tipo === 'pdf'
                      ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}
                >
                  {archivo.tipo === 'pdf' ? <FileText size={18} /> : <LinkIcon size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {archivo.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {archivo.tipo === 'pdf' ? 'Documento PDF' : 'Enlace externo'}
                  </p>
                </div>
              </div>

              {archivo.tipo === 'pdf' && archivo.ruta_storage ? (
                <button
                  type="button"
                  onClick={() => setPdfViendo(archivo)}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#0066cc] dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                  title="Ver documento"
                >
                  <Eye size={16} />
                </button>
              ) : (
                <a
                  href={archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#0066cc] dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                  title="Abrir enlace"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </li>
          ))}
        </ul>
      </ModalShell>

      <VerPDF
        isOpen={!!pdfViendo?.ruta_storage}
        onClose={() => setPdfViendo(null)}
        filePath={pdfViendo?.ruta_storage || ''}
        fileName={pdfViendo?.nombre || ''}
        bucketName={BUCKET_ARCHIVOS_ACTIVIDADES}
      />
    </>
  );
}
