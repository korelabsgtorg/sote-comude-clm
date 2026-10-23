"use client";

import { Eye, Trash2 } from "lucide-react";
import StorageImage from "./StorageImage";
import ImageUploader from "@/components/(uploads)/imgs/ImageUploader";

interface DetalleActividadEvidenciasProps {
  actividadId: string;
  municipioId?: string | number | null;
  imgPaths: string[];
  puedeGestionarFotos: boolean;
  isUploadingImg: boolean;
  onSelectEvidencia: (index: number) => void;
  onEliminarEvidencia: (path: string) => void;
  onSubirEvidencia: (path: string) => void;
}

export default function DetalleActividadEvidencias({
  actividadId,
  municipioId,
  imgPaths,
  puedeGestionarFotos,
  isUploadingImg,
  onSelectEvidencia,
  onEliminarEvidencia,
  onSubirEvidencia,
}: DetalleActividadEvidenciasProps) {
  if (!puedeGestionarFotos && (!imgPaths || imgPaths.length === 0)) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-border/50 pt-6 pb-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Evidencia / Fotos
        </p>
        <span className="text-xs font-medium text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-md">
          {imgPaths.length}/4
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {imgPaths.map((path, idx) => (
          <div
            key={idx}
            className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border/50 shadow-sm"
          >
            <button
              onClick={() => onSelectEvidencia(idx)}
              className="absolute inset-0 w-full h-full cursor-pointer z-0"
            >
              <StorageImage path={path} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
            {puedeGestionarFotos && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEliminarEvidencia(path);
                }}
                className="absolute top-2 right-2 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer z-10"
                title="Eliminar imagen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {puedeGestionarFotos && imgPaths.length < 4 && (
          <div className="relative aspect-[4/3]">
            <ImageUploader
              bucketName="portada_imagenes"
              currentImagePath={null}
              onUploadSuccess={onSubirEvidencia}
              onDeleteSuccess={() => {}}
              disabled={isUploadingImg}
              aspect={4 / 3}
              aspectLabel="Horizontal 4:3"
              maxSizeMB={0.2}
              maxDimension={1920}
              folderPath={`comudes/municipio_${municipioId}/actividad_${actividadId}`}
              compact={true}
              compactClassName="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-azul-trifinio/50 transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  );
}
