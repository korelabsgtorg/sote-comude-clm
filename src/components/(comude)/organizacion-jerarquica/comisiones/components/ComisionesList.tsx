"use client";

import type { ComisionRecord, ComisionIntegranteRecord } from "../lib/zod";
import { ComisionAccordionItem } from "./ComisionAccordionItem";

interface Props {
  comisiones: ComisionRecord[];
  integrantesMap: Record<string, ComisionIntegranteRecord[]>;
  año: number;
  onEditar: (comision: ComisionRecord) => void;
  onAsignar: (comision: ComisionRecord) => void;
}

export function ComisionesList({
  comisiones,
  integrantesMap,
  año,
  onEditar,
  onAsignar,
}: Props) {
  if (comisiones.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
        No hay comisiones registradas para este municipio.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comisiones.map((comision, idx) => {
        const integrantes = integrantesMap[comision.id] ?? [];
        return (
          <ComisionAccordionItem
            key={comision.id}
            comision={comision}
            integrantes={integrantes}
            año={año}
            onEditar={onEditar}
            onAsignar={onAsignar}
            defaultExpanded={idx === 0}
          />
        );
      })}
    </div>
  );
}
