"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Loader2, X } from "lucide-react";
import { cropImage, PixelCrop } from "./cropImage";
import { compressImageFile, isAllowedImageType } from "./constants";
import { toast } from "react-toastify";

interface ImageEditorModalProps {
  imageSrc: string;
  mimeType: string;
  aspect?: number;
  aspectLabel?: string;
  maxSizeMB?: number;
  maxDimension?: number;
  forceFormat?: "image/webp" | "image/png" | "image/jpeg";
  onClose: () => void;
  onApply: (file: File) => Promise<void>;
}

const CROP_HEIGHT = 320;

export default function ImageEditorModal({
  imageSrc,
  mimeType,
  aspect,
  aspectLabel = "Proporción libre",
  maxSizeMB = 0.2,
  maxDimension = 1024,
  forceFormat,
  onClose,
  onApply,
}: ImageEditorModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleMediaLoaded = useCallback(
    (mediaSize: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => {
      const containerWidth = Math.min(window.innerWidth - 64, 512);
      const fitZoom = Math.min(
        containerWidth / mediaSize.width,
        CROP_HEIGHT / mediaSize.height
      );
      setZoom(Math.min(1, fitZoom * 0.95));
      setCrop({ x: 0, y: 0 });
    },
    []
  );

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setUploading(true);
    try {
      const outputMime =
        forceFormat ||
        (mimeType === "image/webp"
          ? "image/webp"
          : mimeType === "image/png"
          ? "image/png"
          : "image/jpeg");
      const blob = await cropImage(imageSrc, croppedAreaPixels, rotation, outputMime);
      const ext = outputMime === "image/webp" ? "webp" : outputMime === "image/png" ? "png" : "jpg";
      let file = new File([blob], `image.${ext}`, { type: outputMime });

      if (!isAllowedImageType(file.type)) {
        toast.error("Solo se permiten imágenes JPEG, PNG y WebP.");
        return;
      }

      file = await compressImageFile(file, maxSizeMB, maxDimension);

      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`La imagen comprimida supera los ${maxSizeMB * 1024} KB. Intente con una imagen más pequeña.`);
        return;
      }

      await onApply(file);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al procesar la imagen.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            {aspectLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="relative w-full bg-white"
          style={{ height: CROP_HEIGHT }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            restrictPosition={false}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onMediaLoaded={handleMediaLoaded}
            style={{
              containerStyle: { background: "#ffffff" },
              cropAreaStyle: { border: "2px solid #059669" },
              mediaStyle: { background: "transparent" },
            }}
          />
        </div>

        <div className="px-4 py-3 space-y-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => r - 90)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> -90°
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => r + 90)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" /> +90°
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={uploading || !croppedAreaPixels}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...
                </>
              ) : (
                "Aplicar y subir"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
