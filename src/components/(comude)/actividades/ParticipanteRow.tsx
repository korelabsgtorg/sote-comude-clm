"use client";

import { cn } from "@/lib/utils";
import { CheckSquare, Square, MapPin, ArrowRightLeft, Loader2, LogIn, LogOut } from "lucide-react";
import { ActComudeConParticipantes, ActComudeRegistro } from "./lib/zod";
import { formatFechaConfirmacion, formatHora, calcDuracion } from "./lib/dateUtils";

interface ParticipanteRowProps {
  participante: ActComudeConParticipantes["act_comude_participantes"][0];
  registros: ActComudeRegistro[];
  userId?: string | null;
  esActividadHoy: boolean;
  puedeGestionar: boolean;
  onRegistrar: (tipo: "entrada" | "salida") => void;
  onVerMapa: () => void;
  onSustituir?: () => void;
  puedeSustituir?: boolean;
  cargandoGPS: boolean;
  isMuyTemprano?: boolean;
  isPastDate: boolean;
  isFinalizada?: boolean;
}

export default function ParticipanteRow({
  participante,
  registros,
  userId,
  esActividadHoy,
  puedeGestionar,
  onRegistrar,
  onVerMapa,
  onSustituir,
  puedeSustituir = false,
  cargandoGPS,
  isMuyTemprano,
  isPastDate,
  isFinalizada = false,
}: ParticipanteRowProps) {
  const regEntrada = registros.find(
    (r) => r.usuario_id === participante.usuario_id && r.tipo_registro === "entrada"
  );
  const regSalida = registros.find(
    (r) => r.usuario_id === participante.usuario_id && r.tipo_registro === "salida"
  );

  const esElUsuario = userId === participante.usuario_id;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1.5 sm:px-4 py-3 rounded-xl bg-muted/40",
        esElUsuario ? "border-2 border-azul-trifinio shadow-none" : "border border-border/40"
      )}
    >
      {/* Info de la persona */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {participante.profiles?.nombre ?? "Sin nombre"}
          </p>
          {participante.confirmed_at ? (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500 mt-0.5">
              <CheckSquare className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              <span>{formatFechaConfirmacion(participante.confirmed_at)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 italic mt-0.5">
              <Square className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
              <span>Sin confirmar</span>
            </div>
          )}
        </div>
      </div>

      {/* Tiempos de asistencia */}
      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 gap-2 sm:gap-6">
        <div className="flex justify-between sm:justify-center w-full sm:w-auto sm:gap-6 text-xs text-muted-foreground">
          {!regEntrada && !regSalida ? (
            <span className="text-muted-foreground dark:text-gray-400 italic sm:mr-4">
              Sin registros de asistencia
            </span>
          ) : (
            <>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5">
                <span className="font-semibold mb-0.5 sm:mb-0">Entrada:</span>
                <span className="font-mono text-[13px] font-medium text-foreground text-center">
                  {regEntrada ? formatHora(regEntrada.created_at) : "--:--"}
                </span>
              </div>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5">
                <span className="font-semibold mb-0.5 sm:mb-0">Salida:</span>
                <span className="font-mono text-[13px] font-medium text-foreground text-center">
                  {regSalida ? formatHora(regSalida.created_at) : "--:--"}
                </span>
              </div>
              <div className="flex flex-col items-center sm:flex-row sm:gap-1.5 text-azul-trifinio">
                <span className="font-semibold mb-0.5 sm:mb-0">Duración:</span>
                <span className="font-mono text-[13px] font-medium text-center">
                  {regEntrada && regSalida ? calcDuracion(regEntrada.created_at, regSalida.created_at) : "--h --m"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Enlace de ubicación */}
        {(puedeGestionar || esElUsuario) && (regEntrada || regSalida) && (
          <button
            onClick={onVerMapa}
            title="Ver ubicación"
            className="text-azul-trifinio flex items-center justify-center bg-azul-trifinio/10 hover:bg-azul-trifinio/20 p-2.5 rounded-xl transition-colors ml-auto sm:ml-0 shrink-0 cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Botones para el propio usuario */}
      {esElUsuario && !isPastDate && (
        <div className="w-full sm:w-auto shrink-0 flex flex-col items-center sm:items-end gap-1.5 mt-2 sm:mt-0">
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-center sm:justify-end gap-2">
            {/* Botón de PC (visible en pantallas medianas y grandes) */}
            {!regSalida && !isFinalizada && puedeSustituir && onSustituir && (
              <button
                onClick={onSustituir}
                type="button"
                className="hidden sm:flex justify-center items-center gap-1.5 text-xs font-semibold border border-azul-trifinio text-azul-trifinio hover:bg-azul-trifinio/10 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                title="Asignar un suplente para que asista en tu lugar"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Asignar Suplente</span>
              </button>
            )}

            {(!regEntrada || !regSalida) && (
              <>
                {!regEntrada ? (
                  <button
                    onClick={() => onRegistrar("entrada")}
                    disabled={cargandoGPS || isMuyTemprano || isFinalizada}
                    className={`flex justify-center items-center gap-2 sm:gap-1.5 text-sm sm:text-xs font-semibold text-white px-4 py-4 sm:py-2 rounded-lg transition-colors w-full sm:w-auto cursor-pointer ${
                      isFinalizada || isMuyTemprano
                        ? "bg-gray-400 dark:bg-neutral-700 dark:text-gray-400 cursor-not-allowed shadow-none"
                        : "bg-green-600 hover:bg-green-700 disabled:opacity-60"
                    }`}
                  >
                    {cargandoGPS ? (
                      <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin shrink-0" />
                    ) : (
                      <LogIn className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                    )}
                    {cargandoGPS ? "Obteniendo ubicación..." : "Marcar Entrada"}
                  </button>
                ) : (
                  <button
                    onClick={() => onRegistrar("salida")}
                    disabled={cargandoGPS || isFinalizada}
                    className={`flex justify-center items-center gap-2 sm:gap-1.5 text-sm sm:text-xs font-semibold px-4 py-4 sm:py-2 rounded-lg transition-colors w-full sm:w-auto cursor-pointer ${
                      isFinalizada
                        ? "bg-gray-400 dark:bg-neutral-700 text-white dark:text-gray-400 cursor-not-allowed shadow-none"
                        : "bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                    }`}
                  >
                    {cargandoGPS ? (
                      <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin shrink-0" />
                    ) : (
                      <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                    )}
                    {cargandoGPS ? "Obteniendo ubicación..." : "Marcar Salida"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Enlace sutil de Asignar Suplente (Solo visible en Móvil) */}
          {!regSalida && !isFinalizada && puedeSustituir && onSustituir && (
            <button
              onClick={onSustituir}
              type="button"
              className="sm:hidden inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-azul-trifinio dark:hover:text-blue-400 transition-colors py-1 px-1.5 rounded cursor-pointer group mt-0.5 text-center"
              title="Asignar un suplente para que asista en tu lugar"
            >
              <ArrowRightLeft className="w-3 h-3 shrink-0 text-muted-foreground group-hover:text-azul-trifinio transition-transform group-hover:scale-110" />
              <span>
                ¿No puedes asistir?{" "}
                <span className="font-semibold text-azul-trifinio dark:text-blue-400 underline underline-offset-2">
                  Asignar un suplente
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
