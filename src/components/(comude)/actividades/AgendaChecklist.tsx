"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { ActComudePunto } from "./lib/zod";

interface AgendaChecklistProps {
  agenda: ActComudePunto[];
  className?: string;
}

export default function AgendaChecklist({ agenda, className }: AgendaChecklistProps) {
  if (!agenda || agenda.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Sin puntos de agenda registrados.</p>
    );
  }

  const isCompletado = (estado: string | null) => {
    return estado === "Aprobado" || estado === "No aprobado" || estado === "Realizado";
  };

  const completados = agenda.filter((i) => isCompletado(i.estado)).length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Agenda
        </p>
        <span className="text-xs text-muted-foreground">
          {completados} / {agenda.length}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-azul-trifinio rounded-full transition-all duration-500"
          style={{ width: `${agenda.length > 0 ? (completados / agenda.length) * 100 : 0}%` }}
        />
      </div>

      <ul className="space-y-2 mt-2">
        {agenda.map((item, idx) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <div
              className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors",
                isCompletado(item.estado)
                  ? "bg-azul-trifinio border-azul-trifinio"
                  : "border-muted-foreground/30"
              )}
            >
              {isCompletado(item.estado) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  "text-sm",
                  isCompletado(item.estado)
                    ? "line-through text-muted-foreground"
                    : "text-foreground font-medium"
                )}
              >
                <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                {item.titulo}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
