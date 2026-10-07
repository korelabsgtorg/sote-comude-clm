"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Camera, ImagePlus, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";
import ImageEditorModal from "./ImageEditorModal";
import {
  ALLOWED_IMAGE_TYPES,
  generateStoragePath,
  isAllowedImageType,
  OBS_ORG_LOGOS_BUCKET,
  ORG_LOGO_SURFACE_CLASS,
  ORG_LOGO_DARK_PLATE_CLASS,
} from "./constants";
import { useStorageDisplayUrl } from "./useStorageDisplayUrl";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";

const ROLES_CAN_UPLOAD = ["super", "admin", "admin-observatorio"];
const COMPACT_LOGO_CLASS =
  "w-[4.5rem] h-[3.75rem] sm:w-28 sm:h-24 lg:w-36 lg:h-32 shrink-0 rounded-lg sm:rounded-xl";

export const ORG_LIST_LOGO_CLASS =
  "w-24 h-20 sm:w-28 sm:h-24 shrink-0 rounded-lg overflow-hidden";

const ORG_LIST_LOGO_SURFACE = "bg-transparent rounded-lg p-0";

interface ImageUploaderProps {
  bucketName?: string;
  currentImagePath: string | null;
  onUploadSuccess: (newPath: string) => void | Promise<void>;
  onDeleteSuccess: () => void | Promise<void>;
  disabled?: boolean;
  aspect?: number;
  aspectLabel?: string;
  compact?: boolean;
  compactClassName?: string;
  maxSizeMB?: number;
  maxDimension?: number;
  folderPath?: string;
  forceFormat?: "image/webp" | "image/png" | "image/jpeg";
}

function LogoViewerModal({
  imageUrl,
  canDelete,
  busy,
  onClose,
  onDelete,
}: {
  imageUrl: string;
  canDelete: boolean;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Logo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={cn(
            "p-6 flex items-center justify-center min-h-48 w-full",
            ORG_LOGO_SURFACE_CLASS,
            ORG_LOGO_DARK_PLATE_CLASS
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Logo de la organización"
            className="max-w-full max-h-64 object-contain"
          />
        </div>

        {canDelete && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="w-full py-2.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/30 disabled:opacity-40 text-red-600 dark:text-red-400 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
            >
              {busy ? (
                <>
                  Eliminando...
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </>
              ) : (
                <>
                  Eliminar
                  <Trash2 className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImageUploader({
  bucketName = OBS_ORG_LOGOS_BUCKET,
  currentImagePath,
  onUploadSuccess,
  onDeleteSuccess,
  disabled = false,
  aspect,
  aspectLabel = "Proporción libre",
  compact = false,
  compactClassName,
  maxSizeMB = 0.2,
  maxDimension = 1024,
  folderPath,
  forceFormat,
}: ImageUploaderProps) {
  const compactLogoClass = compactClassName ?? COMPACT_LOGO_CLASS;
  const compactSurfaceClass = compactClassName ? ORG_LIST_LOGO_SURFACE : ORG_LOGO_SURFACE_CLASS;
  const { effectiveRole } = useUserContext();
  const canUpload = ROLES_CAN_UPLOAD.includes(effectiveRole);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);

  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorMime, setEditorMime] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const { url: previewUrl, loading: previewLoading } = useStorageDisplayUrl(
    bucketName,
    currentImagePath
  );

  useEffect(() => {
    setImgLoaded(false);
  }, [previewUrl, currentImagePath]);

  const handleLogoImgRef = (node: HTMLImageElement | null) => {
    logoImgRef.current = node;
    if (node?.complete && node.naturalWidth > 0) {
      setImgLoaded(true);
    }
  };

  const validateAndOpenEditor = (file: File) => {
    if (!isAllowedImageType(file.type)) {
      toast.error("Solo se permiten imágenes JPEG, PNG y WebP.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setEditorMime(file.type);
    setEditorSrc(objectUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndOpenEditor(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || !canUpload) return;
      const file = e.dataTransfer.files?.[0];
      if (file) validateAndOpenEditor(file);
    },
    [disabled, canUpload]
  );

  const uploadFile = async (file: File) => {
    setBusy(true);
    try {
      const supabase = createClient();
      let path = generateStoragePath(file.type);
      if (folderPath) {
        path = `${folderPath}/${path}`;
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      if (currentImagePath) {
        await supabase.storage.from(bucketName).remove([currentImagePath]);
      }

      await onUploadSuccess(path);
      setViewerOpen(false);
      toast.success("Logo actualizado correctamente.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir la imagen.";
      toast.error(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!currentImagePath) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage.from(bucketName).remove([currentImagePath]);
      if (error) throw error;
      await onDeleteSuccess();
      toast.success("Logo eliminado.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar la imagen.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = () => {
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
  };

  const handleDeleteFromViewer = async () => {
    await handleDelete();
    setViewerOpen(false);
  };

  const waitingForSignedUrl = Boolean(currentImagePath) && previewLoading && !previewUrl;
  const waitingForImgDecode = Boolean(previewUrl) && !imgLoaded;

  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || !canUpload || busy}
        />

        {currentImagePath ? (
          waitingForSignedUrl ? (
            <Skeleton className={compactLogoClass} />
          ) : previewUrl ? (
            <div
              className={cn(
                compactLogoClass,
                "group/logo relative shrink-0",
                compactSurfaceClass,
                ORG_LOGO_DARK_PLATE_CLASS
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerOpen(true);
                }}
                disabled={disabled || busy}
                className="relative flex h-full w-full items-center justify-center cursor-pointer overflow-hidden rounded-[inherit]"
                title="Ver logo"
              >
                {waitingForImgDecode && (
                  <Skeleton className="absolute inset-0 rounded-xl z-10" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={handleLogoImgRef}
                  src={previewUrl}
                  alt="Logo"
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                  className={cn(
                    "h-full w-full object-contain transition-opacity",
                    waitingForImgDecode ? "opacity-0" : "opacity-100"
                  )}
                />
              </button>
              {canUpload && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={busy}
                  className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 z-10 opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer p-0.5 rounded-sm hover:bg-emerald-50/90 dark:hover:bg-emerald-900/40"
                  title="Cambiar logo"
                >
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 drop-shadow-sm" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (canUpload) fileInputRef.current?.click();
              }}
              disabled={disabled || !canUpload || busy}
              className={`${compactLogoClass} bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30 flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors border border-emerald-100 dark:border-emerald-800`}
              title="Subir logo"
            >
              {busy ? (
                <Loader2 className="w-7 h-7 text-emerald-700 dark:text-emerald-500 animate-spin" />
              ) : (
                <Upload className="w-7 h-7 text-emerald-700 dark:text-emerald-500" />
              )}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canUpload) fileInputRef.current?.click();
            }}
            disabled={disabled || !canUpload || busy}
            className={`${compactLogoClass} bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30 flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors border border-emerald-100 dark:border-emerald-800`}
            title="Subir logo"
          >
            {busy ? (
              <Loader2 className="w-7 h-7 text-emerald-700 dark:text-emerald-500 animate-spin" />
            ) : (
              <Upload className="w-7 h-7 text-emerald-700 dark:text-emerald-500" />
            )}
          </button>
        )}

        {viewerOpen && previewUrl && (
          <LogoViewerModal
            imageUrl={previewUrl}
            canDelete={canUpload && !disabled}
            busy={busy}
            onClose={() => setViewerOpen(false)}
            onDelete={handleDeleteFromViewer}
          />
        )}

        {editorSrc && (
          <ImageEditorModal
            imageSrc={editorSrc}
            mimeType={editorMime}
            aspect={aspect}
            aspectLabel={aspectLabel}
            maxSizeMB={maxSizeMB}
            maxDimension={maxDimension}
            forceFormat={forceFormat}
            onClose={closeEditor}
            onApply={uploadFile}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || !canUpload || busy}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || !canUpload || busy}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (canUpload && !disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
        }`}
      >
        {previewUrl ? (
          <div
            className={cn(
              "relative group p-4 flex justify-center m-4 rounded-xl",
              ORG_LOGO_SURFACE_CLASS,
              ORG_LOGO_DARK_PLATE_CLASS
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Vista previa"
              className="max-h-48 rounded-lg object-contain"
            />
            {canUpload && !disabled && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl m-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="p-2 rounded-xl bg-white/90 text-slate-800 cursor-pointer"
                  title="Cambiar imagen"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="p-2 rounded-xl bg-rose-500/90 text-white cursor-pointer"
                  title="Eliminar imagen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-10 px-4 text-center">
            {busy ? (
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500 mb-3">
                  Arrastre una imagen o use los botones
                </p>
                {canUpload && !disabled && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Galería
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-600 text-emerald-600 text-xs font-bold cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <Camera className="w-3.5 h-3.5" /> Cámara
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {editorSrc && (
        <ImageEditorModal
          imageSrc={editorSrc}
          mimeType={editorMime}
          aspect={aspect}
          aspectLabel={aspectLabel}
          maxSizeMB={maxSizeMB}
          maxDimension={maxDimension}
          forceFormat={forceFormat}
          onClose={closeEditor}
          onApply={uploadFile}
        />
      )}
    </div>
  );
}

