"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useSignedUrl } from "../lib/hooks";

interface EvidenciaVisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  paths: string[];
  initialIndex: number;
}

export default function EvidenciaVisorModal({
  isOpen,
  onClose,
  paths,
  initialIndex,
}: EvidenciaVisorModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setCurrentIndex(initialIndex);
  }, [isOpen, initialIndex]);

  const path = paths[currentIndex];
  const { data: url, isLoading } = useSignedUrl(isOpen ? path : null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full h-[calc(100dvh-4rem)] sm:h-auto sm:max-h-[90dvh] sm:max-w-6xl flex flex-col bg-background rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
          <h3 className="text-foreground font-bold text-sm tracking-wider uppercase">
            Visor de Evidencia
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-black/5 min-h-0">
          {isLoading || !url ? (
            <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin" />
          ) : (
            <img
              src={url}
              alt="Evidencia ampliada"
              className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
            />
          )}
        </div>

        {paths.length > 1 && (
          <div className="flex items-center justify-center gap-8 p-4 border-t border-border/50 bg-muted/30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((i) => (i - 1 + paths.length) % paths.length);
              }}
              className="p-3 rounded-full bg-background border border-border/50 text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-muted-foreground tracking-widest">
              {currentIndex + 1} / {paths.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((i) => (i + 1) % paths.length);
              }}
              className="p-3 rounded-full bg-background border border-border/50 text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
