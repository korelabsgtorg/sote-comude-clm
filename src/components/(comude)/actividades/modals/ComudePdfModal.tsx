"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { ActComudeConParticipantes, ActComudeRegistro } from "../lib/zod";
import ComudePdfDocument from "../pdf/ComudePdfDocument";
import { usePDF } from "@react-pdf/renderer";

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLogoUrl(`${window.location.origin}/sote/logo.png`);
    }
  }, []);

  if (!isOpen) return null;

  const doc = (
    <ComudePdfDocument
      actividad={actividad}
      registros={registros}
      evidenciaUrls={evidenciaUrls}
      logoUrl={logoUrl}
    />
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="bg-red-600/10 text-red-600 p-2 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Vista Previa Sesión COMUDE</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
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
