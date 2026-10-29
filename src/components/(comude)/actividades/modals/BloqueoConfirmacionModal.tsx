"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Calendar, ClipboardList, MapPin, Loader2 } from "lucide-react";
import { getActividadPendienteConfirmacion, confirmarParticipacionComude } from "../lib/actions";
import { createClient } from "@/utils/supabase/client";

export default function BloqueoConfirmacionModal() {
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);

  const { data: pendiente, refetch } = useQuery({
    queryKey: ["actividad-pendiente-confirmacion"],
    queryFn: async () => {
      return await getActividadPendienteConfirmacion();
    },
    staleTime: 1000 * 60 * 5,
  });

  // Supabase Realtime para recibir cambios en tiempo real sin saturar con polling
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bloqueo-comude-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "act_comude" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["actividad-pendiente-confirmacion"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "act_comude_participantes" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["actividad-pendiente-confirmacion"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Listener para el evento de refresco disparado por el Service Worker / PushListener
  useEffect(() => {
    const onRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["actividad-pendiente-confirmacion"] });
      void refetch();
    };

    window.addEventListener("actividad-pendiente-refresh", onRefresh);
    return () => {
      window.removeEventListener("actividad-pendiente-refresh", onRefresh);
    };
  }, [refetch, queryClient]);

  // Bloquear el scroll del body mientras exista una actividad pendiente
  useEffect(() => {
    if (pendiente) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [pendiente]);

  if (!pendiente) return null;

  const handleConfirmar = async () => {
    try {
      setConfirmando(true);
      await confirmarParticipacionComude(pendiente.actComudeId);
      await queryClient.invalidateQueries({ queryKey: ["actividad-pendiente-confirmacion"] });
      await refetch();
    } catch (err) {
      console.error("Error al confirmar enterado:", err);
    } finally {
      setConfirmando(false);
    }
  };

  const formatFechaModal = (isoStr: string) => {
    const fecha = new Date(isoStr);
    const dias = ["Dom", "Mié", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    // Corregir nombres de días estándar
    const diasFull = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const diaName = diasFull[fecha.getDay()];
    const d = fecha.getDate().toString().padStart(2, "0");
    const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
    const y = fecha.getFullYear().toString().slice(-2);
    let hours = fecha.getHours();
    const minutes = fecha.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${diaName} ${d}/${m}/${y}, ${hours}:${minutes} ${ampm}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none"
    >
      <div className="bg-[#12131c] text-white border border-blue-500/30 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Barra superior de acento azul/índigo */}
        <div className="h-2.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

        <div className="p-6 sm:p-7 space-y-6">
          {/* Icono central estilizado */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <ClipboardList className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-blue-400 tracking-tight uppercase flex items-center justify-center gap-2">
                CONVOCATORIA A COMUDE
              </h2>
              <p className="text-xs text-gray-300 font-medium mt-1">
                Se te ha convocado a una sesión COMUDE. Confirma que estás enterado.
              </p>
            </div>
          </div>

          {/* Tarjeta de información del COMUDE */}
          <div className="bg-[#181a28] border border-blue-500/25 rounded-2xl p-5 space-y-4 shadow-lg">
            <div>
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                COMUDE:
              </span>
              <h3 className="text-lg font-bold text-white mt-1 leading-snug">
                {pendiente.titulo}
              </h3>
            </div>

            {pendiente.descripcion && (
              <p className="text-xs text-gray-300 bg-[#10111a] p-3 rounded-xl border border-blue-500/10 max-h-24 overflow-y-auto">
                {pendiente.descripcion}
              </p>
            )}

            {/* Fecha formateada en contenedor oscuro */}
            <div className="bg-[#0c0d14] border border-blue-500/20 rounded-xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-blue-300/80 uppercase tracking-wider block">
                  FECHA Y HORA:
                </span>
                <span className="text-xs sm:text-sm font-bold text-white block truncate">
                  {formatFechaModal(pendiente.fecha)}
                </span>
              </div>
            </div>

            {pendiente.ubicacion && (
              <div className="bg-[#0c0d14] border border-blue-500/20 rounded-xl p-3.5 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-blue-300/80 uppercase tracking-wider block">
                    LUGAR:
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white block truncate">
                    {pendiente.ubicacion}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Botón de Confirmar y leyenda inferior */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleConfirmar}
              disabled={confirmando}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2.5 text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confirmando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Confirmando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>CONFIRMAR DE ENTERADO</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-gray-400 text-center px-2">
              Al hacer clic, se registrará digitalmente su confirmación con fecha y hora.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
