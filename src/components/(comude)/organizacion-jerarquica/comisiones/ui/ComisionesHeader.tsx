"use client";

import { Plus, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  año: number;
  onAñoChange: (año: number) => void;
  onNuevaComision: () => void;
  totalComisiones: number;
}

const AÑOS_DISPONIBLES = [2024, 2025, 2026, 2027, 2028];

export function ComisionesHeader({
  año,
  onAñoChange,
  onNuevaComision,
  totalComisiones,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-celeste-trifinio/10 text-celeste-trifinio">
          <Users className="size-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Comisiones de Trabajo
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {totalComisiones} comisiones registradas para el municipio
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold">
          <Calendar className="size-4 text-celeste-trifinio" />
          <span className="text-muted-foreground">Año:</span>
          <select
            value={año}
            onChange={(e) => onAñoChange(Number(e.target.value))}
            className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
          >
            {AÑOS_DISPONIBLES.map((a) => (
              <option key={a} value={a} className="bg-popover text-popover-foreground">
                {a}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={onNuevaComision} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Nueva Comisión
        </Button>
      </div>
    </div>
  );
}
