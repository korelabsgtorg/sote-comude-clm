"use client";

import { Users, Shield, UserCheck } from "lucide-react";
import { ActComudeConParticipantes, ActComudeRegistro } from "./lib/zod";
import ParticipanteRow from "./ParticipanteRow";

interface DetalleActividadParticipantesProps {
  actividad: ActComudeConParticipantes;
  registros: ActComudeRegistro[];
  userId?: string | null;
  hoy: boolean;
  canManageActive: boolean;
  onRegistrar: (tipo: "entrada" | "salida") => void;
  cargandoGPS: boolean;
  isMuyTemprano: boolean;
  isPastDate: boolean;
  esFinalizada: boolean;
  onVerMapa: (nombre: string, usuarioId: string) => void;
}

export default function DetalleActividadParticipantes({
  actividad,
  registros,
  userId,
  hoy,
  canManageActive,
  onRegistrar,
  cargandoGPS,
  isMuyTemprano,
  isPastDate,
  esFinalizada,
  onVerMapa,
}: DetalleActividadParticipantesProps) {
  const encargados = actividad.act_comude_participantes.filter(
    (p) => p.encargado && p.usuario_id !== userId
  );
  const integrantes = actividad.act_comude_participantes.filter(
    (p) => !p.encargado && p.usuario_id !== userId
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Encargados */}
      {encargados.length > 0 && (
        <div className="px-1 sm:px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-azul-trifinio" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Encargados
            </p>
          </div>
          <div className="space-y-2">
            {encargados.map((p) => (
              <ParticipanteRow
                key={p.usuario_id}
                participante={p}
                registros={registros}
                userId={userId}
                esActividadHoy={hoy}
                puedeGestionar={canManageActive}
                onRegistrar={handleRegistrarHelper}
                cargandoGPS={cargandoGPS}
                onVerMapa={() => onVerMapa(p.profiles?.nombre || "Sin nombre", p.usuario_id)}
                isMuyTemprano={isMuyTemprano}
                isPastDate={isPastDate}
                isFinalizada={esFinalizada}
              />
            ))}
          </div>
        </div>
      )}

      {/* Integrantes */}
      {integrantes.length > 0 && (
        <div className="px-1 sm:px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Integrantes
            </p>
          </div>
          <div className="space-y-2">
            {integrantes.map((p) => (
              <ParticipanteRow
                key={p.usuario_id}
                participante={p}
                registros={registros}
                userId={userId}
                esActividadHoy={hoy}
                puedeGestionar={canManageActive}
                onRegistrar={handleRegistrarHelper}
                cargandoGPS={cargandoGPS}
                onVerMapa={() => onVerMapa(p.profiles?.nombre || "Sin nombre", p.usuario_id)}
                isMuyTemprano={isMuyTemprano}
                isPastDate={isPastDate}
                isFinalizada={esFinalizada}
              />
            ))}
          </div>
        </div>
      )}

      {actividad.act_comude_participantes.length === 0 && (
        <div className="px-3 sm:px-6 py-10 text-center text-muted-foreground text-sm">
          <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No hay miembros asignados a esta actividad.</p>
        </div>
      )}
    </div>
  );

  function handleRegistrarHelper(tipo: "entrada" | "salida") {
    onRegistrar(tipo);
  }
}
