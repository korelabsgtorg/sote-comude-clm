import { useEffect, useState } from 'react';
import { ModalShell } from '@/components/ui/general-modal';
import { Button } from '@/components/ui/button';
import { ExternalLink, Eye, FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import dynamic from 'next/dynamic';

const ActaVisorModal = dynamic(() => import('./ActaVisorModal'), { ssr: false });

const BUCKET_ARCHIVOS_ACTIVIDADES = 'archivos_actividades';

export interface ArchivoAdjuntoActividad {
  id: string;
  nombre: string;
  url?: string;
  ruta_storage?: string;
  tipo?: 'pdf' | 'enlace' | string;
}

interface ArchivosActividadModalProps {
  open: boolean;
  onClose: () => void;
  tituloActividad: string;
  archivos: ArchivoAdjuntoActividad[];
}

export default function ArchivosActividadModal({
  open,
  onClose,
  tituloActividad,
  archivos,
}: ArchivosActividadModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfNombre, setPdfNombre] = useState<string>('');
  const [loadingArchivoId, setLoadingArchivoId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPdfUrl(null);
      setPdfNombre('');
      setLoadingArchivoId(null);
    }
  }, [open]);

  const abrirPdf = async (archivo: ArchivoAdjuntoActividad) => {
    // Si ya tiene URL pública o firmada directa (como en la vista de mis actividades), usarla directamente
    if (archivo.url) {
      setPdfUrl(archivo.url);
      setPdfNombre(archivo.nombre);
      return;
    }

    if (!archivo.ruta_storage) return;

    setLoadingArchivoId(archivo.id);
    try {
      const supabase = createClient();
      // Intentar primero en archivos_tareas y luego en archivos_actividades
      let signedUrl: string | null = null;

      const { data: dataTareas } = await supabase.storage
        .from('archivos_tareas')
        .createSignedUrl(archivo.ruta_storage, 3600);

      if (dataTareas?.signedUrl) {
        signedUrl = dataTareas.signedUrl;
      } else {
        const { data: dataActividades } = await supabase.storage
          .from('archivos_actividades')
          .createSignedUrl(archivo.ruta_storage, 3600);
        signedUrl = dataActividades?.signedUrl || null;
      }

      if (signedUrl) {
        setPdfUrl(signedUrl);
      } else {
        const { data: pubData } = supabase.storage
          .from('archivos_tareas')
          .getPublicUrl(archivo.ruta_storage);
        setPdfUrl(pubData.publicUrl);
      }
      setPdfNombre(archivo.nombre);
    } catch (err) {
      console.error('Error abriendo PDF:', err);
    } finally {
      setLoadingArchivoId(null);
    }
  };

  return (
    <>
      <ModalShell
        open={open && !pdfUrl}
        onClose={onClose}
        title="Archivos cargados"
        subtitle={tituloActividad}
      >
        {archivos.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No hay archivos adjuntos en esta actividad.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {archivos.map((archivo) => {
              const esPdf = archivo.tipo === 'pdf' || archivo.nombre?.toLowerCase().endsWith('.pdf');

              return (
                <li
                  key={archivo.id}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        esPdf
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {esPdf ? <FileText size={18} /> : <LinkIcon size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {archivo.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {esPdf ? 'Documento PDF' : 'Enlace externo'}
                      </p>
                    </div>
                  </div>

                  {esPdf ? (
                    <button
                      type="button"
                      onClick={() => abrirPdf(archivo)}
                      disabled={loadingArchivoId === archivo.id}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-azul-trifinio dark:hover:text-celeste-trifinio"
                      title="Ver documento"
                    >
                      {loadingArchivoId === archivo.id ? (
                        <Loader2 size={16} className="animate-spin text-azul-trifinio" />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  ) : (
                    <a
                      href={archivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-azul-trifinio dark:hover:text-celeste-trifinio"
                      title="Abrir enlace"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs rounded-xl"
          >
            Cerrar
          </Button>
        </div>
      </ModalShell>

      {pdfUrl && (
        <ActaVisorModal
          isOpen={!!pdfUrl}
          onClose={() => setPdfUrl(null)}
          actaUrl={pdfUrl}
          actividadNombre={pdfNombre}
          puedeGestionar={false}
        />
      )}
    </>
  );
}
