"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { X, Printer, Download, Loader2, FileText } from "lucide-react";
import { ActComudeConParticipantes, ActComudeRegistro } from "../lib/zod";
import ComudePdfDocument from "../pdf/ComudePdfDocument";
import { pdf } from "@react-pdf/renderer";
import { toast } from "react-toastify";

// Cargamos PDFViewer dinámicamente sin SSR
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-muted/20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> }
);

interface ComudePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  actividad: ActComudeConParticipantes;
  registros: ActComudeRegistro[];
  evidenciaUrls?: string[];
}

export default function ComudePdfModal({
  isOpen,
  onClose,
  actividad,
  registros,
  evidenciaUrls = [],
}: ComudePdfModalProps) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [isGeneratingBlob, setIsGeneratingBlob] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLogoUrl(`${window.location.origin}/sote/logo.png`);
    }
  }, []);

  const doc = useMemo(
    () => (
      <ComudePdfDocument
        actividad={actividad}
        registros={registros}
        evidenciaUrls={evidenciaUrls}
        logoUrl={logoUrl}
      />
    ),
    [actividad, registros, evidenciaUrls, logoUrl]
  );

  if (!isOpen) return null;

  const getFileName = () => {
    const titulo = actividad.detalles_sesion?.titulo?.replace(/[^a-zA-Z0-9]/g, "_") || "Sesion_COMUDE";
    return `COMUDE_${titulo}.pdf`;
  };

  const handleDescargar = async () => {
    setIsGeneratingBlob(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getFileName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el archivo para descargar");
    } finally {
      setIsGeneratingBlob(false);
    }
  };

  const handleImprimir = async () => {
    setIsGeneratingBlob(true);
    try {
      const blob = await pdf(doc).toBlob();
      const blobUrl = URL.createObjectURL(blob);

      // Creamos un iframe invisible para la impresión directa (funciona en Safari, Chrome, Firefox, iOS/Android)
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        }, 300);
      };
    } catch (e) {
      console.error(e);
      // Fallback: abrir en nueva pestaña para que el navegador maneje la impresión
      try {
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (err) {
        toast.error("Error al preparar el documento para impresión");
      }
    } finally {
      setIsGeneratingBlob(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex flex-wrap items-center justify-between px-3 sm:px-5 py-2.5 border-b border-border bg-muted/30 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-red-600/10 text-red-600 p-1.5 sm:p-2 rounded-lg shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm md:text-base leading-tight truncate">
                Vista Previa Sesión COMUDE
              </h3>
            </div>
          </div>

          {/* Botones de acción universales */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleDescargar}
              disabled={isGeneratingBlob}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Descargar PDF"
            >
              {isGeneratingBlob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Descargar</span>
            </button>

            <button
              onClick={handleImprimir}
              disabled={isGeneratingBlob}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Imprimir PDF"
            >
              {isGeneratingBlob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block" />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visor PDF */}
        <div className="flex-1 w-full bg-neutral-900 overflow-hidden relative">
          <PDFViewer className="w-full h-full border-none">
            {doc}
          </PDFViewer>
        </div>
      </div>
    </div>
  );
}
