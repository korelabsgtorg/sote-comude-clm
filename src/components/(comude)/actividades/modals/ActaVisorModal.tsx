"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileText, ExternalLink, Loader2, ChevronLeft, ChevronRight, ZoomOut, ZoomIn, Trash2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configurar el worker de PDF.js usando CDN para que coincida con la versión instalada
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ActaVisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  actaUrl: string;
  actividadNombre: string;
  puedeGestionar?: boolean;
  onEliminar?: () => void;
}

export default function ActaVisorModal({
  isOpen,
  onClose,
  actaUrl,
  actividadNombre,
  puedeGestionar,
  onEliminar,
}: ActaVisorModalProps) {
  const [mounted, setMounted] = useState(false);
  
  // Estados para el visor de PDF
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loadingPdf, setLoadingPdf] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reiniciar estado cada vez que se abre una nueva URL
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setPageNumber(1);
      setScale(1.0);
      setLoadingPdf(true);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen, actaUrl]);

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[1050] flex flex-col bg-[#1a1a1a] sm:bg-[#111] animate-in fade-in duration-200">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-row items-center justify-between px-3 sm:px-6 py-2 sm:py-4 bg-[#222] border-b border-neutral-800 gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 sm:p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm sm:text-lg leading-tight truncate">
              {actividadNombre}
            </h2>
            <p className="text-gray-400 text-[10px] sm:text-xs hidden sm:block">Visor de documento PDF</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {puedeGestionar && onEliminar && (
            <button
              onClick={onEliminar}
              className="flex items-center justify-center p-1.5 sm:px-3 sm:py-2 bg-red-900/20 hover:bg-red-500/20 border border-red-900/50 hover:border-red-500/50 text-red-400 font-medium rounded-lg transition-colors"
              title="Eliminar acta permanentemente"
            >
              <Trash2 className="w-4 h-4 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline sm:ml-2 text-sm">Eliminar acta</span>
            </button>
          )}
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 bg-neutral-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* TOOLBAR DEL PDF */}
      <div className="flex items-center justify-center px-2 py-1.5 sm:px-4 sm:py-2 bg-[#1a1a1a] border-b border-neutral-800 text-white shrink-0 shadow-sm z-10 overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2 bg-neutral-800 rounded-lg p-1">
           <button 
            onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
            disabled={pageNumber <= 1} 
            className="p-1.5 hover:bg-neutral-700 text-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Página anterior"
           >
             <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
           </button>
           
           <span className="text-xs sm:text-sm font-mono mx-1 sm:mx-2 min-w-[50px] sm:min-w-[60px] text-center">
             {pageNumber} / {numPages || '-'}
           </span>
           
           <button 
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} 
            disabled={pageNumber >= numPages} 
            className="p-1.5 hover:bg-neutral-700 text-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Página siguiente"
           >
             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
           </button>
           
           <div className="h-4 w-px bg-neutral-600 mx-1 sm:mx-2" />
           
           <button 
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))} 
            className="p-1.5 hover:bg-neutral-700 text-gray-300 rounded transition-colors"
            title="Alejar"
           >
             <ZoomOut className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
           </button>
           <span className="text-xs sm:text-sm font-mono min-w-[36px] sm:min-w-[40px] text-center text-gray-400">
             {Math.round(scale * 100)}%
           </span>
           <button 
            onClick={() => setScale(s => Math.min(3.0, s + 0.2))} 
            className="p-1.5 hover:bg-neutral-700 text-gray-300 rounded transition-colors"
            title="Acercar"
           >
             <ZoomIn className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
           </button>
        </div>
      </div>

      {/* PDF VIEWER CONTENT */}
      <div className="flex-1 w-full bg-[#2a2a2a] relative overflow-auto flex justify-center py-2 sm:py-8 custom-scrollbar">
        {loadingPdf && (
           <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#2a2a2a]/80 z-10">
             <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
             <span className="text-sm font-medium text-gray-300 tracking-wide">Procesando documento...</span>
           </div>
        )}
        
        <Document
          file={actaUrl}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setLoadingPdf(false);
          }}
          loading={null} // Ocultar el loading interno ya que usamos nuestro Loader2 arriba
          error={<div className="mt-10 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-center font-medium max-w-sm">No se pudo renderizar el PDF. Verifique que el archivo no esté corrupto.</div>}
          className="shadow-2xl shadow-black/50"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale} 
            renderTextLayer={false} 
            renderAnnotationLayer={false}
            className="bg-white rounded-sm overflow-hidden"
          />
        </Document>
      </div>

      {/* SCROLLBAR STYLES FOR THE MODAL VIEWER */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}} />

    </div>
  );

  return createPortal(modalContent, document.body);
}
