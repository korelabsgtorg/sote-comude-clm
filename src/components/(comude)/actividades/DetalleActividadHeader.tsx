"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRef } from "react";
import { ActComudeConParticipantes } from "./lib/zod";
import { formatFechaCorto, formatHora } from "./lib/dateUtils";

interface DetalleActividadHeaderProps {
  actividad: ActComudeConParticipantes;
  puedeGestionarAgenda: boolean;
  isUpdatingEstado: boolean;
  isUploadingActa: boolean;
  isGenerandoUrl: boolean;
  isCargandoPdfData: boolean;
  onClose?: () => void;
  onActualizarEstado: () => void;
  onVerActa: () => void;
  onCargarActa: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGeneratePdf: () => void;
  onAbrirNuevoPunto: () => void;
  estadoBotonLabel: string | null;
  estadoBotonStyle: string;
}

export default function DetalleActividadHeader({
  actividad,
  puedeGestionarAgenda,
  isUpdatingEstado,
  isUploadingActa,
  isGenerandoUrl,
  isCargandoPdfData,
  onClose,
  onActualizarEstado,
  onVerActa,
  onCargarActa,
  onGeneratePdf,
  onAbrirNuevoPunto,
  estadoBotonLabel,
  estadoBotonStyle,
}: DetalleActividadHeaderProps) {
  const actaFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1.5 sm:px-6 py-3 border-b border-border/50 border-dashed bg-muted/10 gap-3 sm:gap-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-azul-trifinio font-medium hover:underline text-sm w-fit cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Volver
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Botón aperturar/finalizar COMUDE */}
          {puedeGestionarAgenda && estadoBotonLabel && estadoBotonStyle && (
            <button
              onClick={onActualizarEstado}
              disabled={isUpdatingEstado}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2 ${estadoBotonStyle}`}
            >
              {isUpdatingEstado && <Loader2 className="w-4 h-4 animate-spin" />}
              {estadoBotonLabel}
            </button>
          )}

          {/* Ver Acta / Subir Acta */}
          {actividad.acta && actividad.acta.length > 0 ? (
            <button
              onClick={onVerActa}
              disabled={isGenerandoUrl}
              className="border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-transparent hover:bg-blue-600/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2 cursor-pointer"
            >
              {isGenerandoUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Ver Acta
            </button>
          ) : puedeGestionarAgenda ? (
            <button
              onClick={() => actaFileInputRef.current?.click()}
              disabled={isUploadingActa}
              className="border border-zinc-700 text-zinc-700 dark:border-zinc-300 dark:text-zinc-200 bg-transparent hover:bg-zinc-500/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2 cursor-pointer"
            >
              {isUploadingActa ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Subir Acta
            </button>
          ) : null}

          <input
            type="file"
            ref={actaFileInputRef}
            className="hidden"
            accept="application/pdf"
            onChange={onCargarActa}
          />

          {actividad.estado === "Finalizada" ? (
            <button
              onClick={onGeneratePdf}
              disabled={isCargandoPdfData}
              className="border border-red-600 text-red-600 dark:text-red-400 dark:border-red-500 bg-transparent hover:bg-red-600/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2 cursor-pointer"
            >
              {isCargandoPdfData ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generar PDF
            </button>
          ) : puedeGestionarAgenda ? (
            <button
              onClick={onAbrirNuevoPunto}
              className="border border-purple-500 text-purple-600 dark:text-purple-400 dark:border-purple-400 bg-transparent hover:bg-purple-500/10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap flex-1 sm:flex-none gap-2 cursor-pointer"
            >
              Nuevo Punto a tratar
            </button>
          ) : null}
        </div>
      </div>

      {/* Header Info */}
      <div className="px-1.5 sm:px-6 py-4 grid grid-cols-2 gap-4">
        {/* Col 1 */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Agenda COMUDE:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight">
              {actividad.detalles_sesion?.titulo || "Sin título"}
            </p>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Información:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] uppercase leading-tight">
              {actividad.detalles_sesion?.acta ? `ACTA ${actividad.detalles_sesion.acta}` : ""}
              {actividad.detalles_sesion?.acta && actividad.detalles_sesion?.libro ? ", " : ""}
              {actividad.detalles_sesion?.libro ? `LIBRO ${actividad.detalles_sesion.libro}` : ""}
              {!actividad.detalles_sesion?.acta && !actividad.detalles_sesion?.libro ? "Sin lugar definido" : ""}
            </p>
          </div>
        </div>

        {/* Col 2 */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
                Fecha:
              </h2>
              <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight capitalize">
                {formatFechaCorto(actividad.fecha)}
              </p>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
                Hora:
              </h2>
              <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight uppercase">
                {formatHora(actividad.fecha)}
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0d47a1] dark:text-blue-400 leading-tight">
              Lugar:
            </h2>
            <p className="text-foreground dark:text-white font-bold text-[15px] leading-tight">
              {actividad.ubicacion || "Gimnasio Municipal"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
