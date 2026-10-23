'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArchivoAdjunto, BUCKET_ARCHIVOS_TAREAS } from './lib/zod';
import { useTareaMutations } from './lib/hooks';
import { FileText, Link as LinkIcon, Trash2, Loader2, Upload, ExternalLink } from 'lucide-react';
import dynamic from 'next/dynamic';

const ActaVisorModal = dynamic(
  () => import('@/components/(comude)/actividades/modals/ActaVisorModal'),
  { ssr: false }
);

interface Props {
  tareaId: string;
  archivosIniciales: ArchivoAdjunto[] | null;
  esLectura?: boolean;
  onVerPdf?: (archivo: ArchivoAdjunto) => void;
  nombreUsuarioActual?: string;
}

export default function GestorArchivos({
  tareaId,
  archivosIniciales,
  esLectura,
  onVerPdf,
  nombreUsuarioActual,
}: Props) {
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>(archivosIniciales || []);
  const [isUploading, setIsUploading] = useState(false);
  const [mostrarLinkInput, setMostrarLinkInput] = useState(false);
  const [nuevoLink, setNuevoLink] = useState('');
  const [nuevoLinkNombre, setNuevoLinkNombre] = useState('');
  const [pdfViendo, setPdfViendo] = useState<ArchivoAdjunto | null>(null);

  const { actualizarArchivos } = useTareaMutations();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const nuevos: ArchivoAdjunto[] = [...archivos];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        alert(`El archivo ${file.name} no es un PDF válido.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        alert(`El archivo ${file.name} excede los 15MB permitidos.`);
        continue;
      }

      const fileExt = 'pdf';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${safeName}`;
      const filePath = `${tareaId}/${fileName}`;

      const { error } = await supabase.storage
        .from(BUCKET_ARCHIVOS_TAREAS)
        .upload(filePath, file);

      if (error) {
        console.error('Error al subir archivo:', error);
        alert(`Error al subir ${file.name}: ${error.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ARCHIVOS_TAREAS)
        .getPublicUrl(filePath);

      nuevos.push({
        id: crypto.randomUUID(),
        tipo: 'pdf',
        nombre: file.name,
        url: publicUrlData.publicUrl,
        ruta_storage: filePath,
        cargado_por: nombreUsuarioActual || undefined,
      });
    }

    setArchivos(nuevos);
    actualizarArchivos.mutate({ id: tareaId, archivos: nuevos });
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = () => {
    if (!nuevoLink) return;

    let urlToSave = nuevoLink.trim();
    if (!/^https?:\/\//i.test(urlToSave)) {
      urlToSave = 'https://' + urlToSave;
    }

    const nuevos: ArchivoAdjunto[] = [
      ...archivos,
      {
        id: crypto.randomUUID(),
        tipo: 'enlace',
        nombre: nuevoLinkNombre.trim() || urlToSave,
        url: urlToSave,
        cargado_por: nombreUsuarioActual || undefined,
      },
    ];

    setArchivos(nuevos);
    actualizarArchivos.mutate({ id: tareaId, archivos: nuevos });

    setNuevoLink('');
    setNuevoLinkNombre('');
    setMostrarLinkInput(false);
  };

  const handleDelete = async (archivo: ArchivoAdjunto) => {
    if (archivo.tipo === 'pdf' && archivo.ruta_storage) {
      const { error } = await supabase.storage
        .from(BUCKET_ARCHIVOS_TAREAS)
        .remove([archivo.ruta_storage]);

      if (error) {
        console.error('Error eliminando archivo de storage:', error);
      }
    }

    const nuevos = archivos.filter((a) => a.id !== archivo.id);
    setArchivos(nuevos);
    actualizarArchivos.mutate({ id: tareaId, archivos: nuevos });
  };

  const abrirPdf = (archivo: ArchivoAdjunto) => {
    if (onVerPdf) {
      onVerPdf(archivo);
      return;
    }
    setPdfViendo(archivo);
  };

  const handleOpenArchivo = (e: React.MouseEvent, archivo: ArchivoAdjunto) => {
    if (archivo.tipo === 'enlace') {
      window.open(archivo.url, '_blank', 'noopener,noreferrer');
      return;
    }

    e.preventDefault();
    if (archivo.tipo === 'pdf') {
      if (archivo.url) {
        abrirPdf(archivo);
      }
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
          Archivos y Enlaces Adjuntos
        </h4>
        {!esLectura && (
          <div className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/pdf"
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => setMostrarLinkInput(!mostrarLinkInput)}
              className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium transition-colors cursor-pointer"
            >
              <LinkIcon size={14} /> Añadir Enlace
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs flex items-center gap-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Subir PDF
            </button>
          </div>
        )}
      </div>

      {mostrarLinkInput && !esLectura && (
        <div className="bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-slate-200 dark:border-neutral-700 mb-3 flex flex-col gap-2">
          <input
            type="text"
            placeholder="URL del enlace (ej. https://drive.google.com/...)"
            value={nuevoLink}
            onChange={(e) => setNuevoLink(e.target.value)}
            className="w-full text-sm p-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-md outline-none focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre a mostrar (opcional)"
              value={nuevoLinkNombre}
              onChange={(e) => setNuevoLinkNombre(e.target.value)}
              className="w-full text-sm p-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-md outline-none focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!nuevoLink}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {archivos.length === 0 ? (
        <div className="text-[13px] text-slate-500 dark:text-gray-400 italic py-2 text-center bg-slate-50/50 dark:bg-neutral-900/30 rounded-lg border border-dashed border-slate-200 dark:border-neutral-800">
          No hay archivos ni enlaces adjuntos.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {archivos.map((archivo) => (
            <div
              key={archivo.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:border-slate-300 dark:hover:border-neutral-600"
            >
              <button
                type="button"
                onClick={(e) => handleOpenArchivo(e, archivo)}
                className="flex w-full cursor-pointer items-center gap-3 overflow-hidden group text-left"
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
                    archivo.tipo === 'pdf'
                      ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/40'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40'
                  }`}
                >
                  {archivo.tipo === 'pdf' ? <FileText size={18} /> : <LinkIcon size={18} />}
                </div>
                <div className="flex flex-col overflow-hidden w-full">
                  <span className="text-sm font-semibold text-slate-700 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {archivo.nombre}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-gray-500 truncate flex items-center gap-1 font-medium mt-0.5">
                    {archivo.tipo === 'pdf' ? 'Documento PDF' : 'Enlace externo'}
                    {archivo.tipo === 'enlace' ? <ExternalLink size={10} className="opacity-70" /> : null}
                    {archivo.cargado_por && (
                      <span className="ml-1 text-slate-300 dark:text-gray-600">
                        · Subido por: {archivo.cargado_por}
                      </span>
                    )}
                  </span>
                </div>
              </button>

              {!esLectura && (
                <button
                  type="button"
                  onClick={() => handleDelete(archivo)}
                  className="p-2 ml-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-red-500/50 cursor-pointer"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pdfViendo && (
        <ActaVisorModal
          isOpen={!!pdfViendo}
          onClose={() => setPdfViendo(null)}
          actaUrl={pdfViendo.url}
          actividadNombre={pdfViendo.nombre}
        />
      )}
    </div>
  );
}
