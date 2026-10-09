"use client";

import { useState } from "react";
import { useComisiones, useIntegrantesComisiones } from "./lib/hooks";
import { ComisionesHeader } from "./ui/ComisionesHeader";
import { ComisionesList } from "./ui/ComisionesList";
import { CrearEditarComisionModal } from "./modals/CrearEditarComisionModal";
import { AsignarIntegranteModal } from "./modals/AsignarIntegranteModal";
import type { ComisionRecord } from "./lib/zod";

export function ComisionesManager() {
  const añoActual = new Date().getFullYear();
  const [año, setAño] = useState<number>(añoActual);

  const { data: comisiones = [], isLoading: loadingComisiones } = useComisiones();
  const { data: integrantesMap = {}, isLoading: loadingIntegrantes } =
    useIntegrantesComisiones(año);

  const [crearEditarModalOpen, setCrearEditarModalOpen] = useState(false);
  const [comisionEditar, setComisionEditar] = useState<ComisionRecord | null>(null);

  const [asignarModalOpen, setAsignarModalOpen] = useState(false);
  const [comisionAsignar, setComisionAsignar] = useState<ComisionRecord | null>(null);

  const handleNuevaComision = () => {
    setComisionEditar(null);
    setCrearEditarModalOpen(true);
  };

  const handleEditarComision = (comision: ComisionRecord) => {
    setComisionEditar(comision);
    setCrearEditarModalOpen(true);
  };

  const handleAsignarIntegrante = (comision: ComisionRecord) => {
    setComisionAsignar(comision);
    setAsignarModalOpen(true);
  };

  const integrantesActualesIds = comisionAsignar
    ? (integrantesMap[comisionAsignar.id] ?? []).map((i) => i.id_integrante)
    : [];

  return (
    <div className="space-y-6">
      <ComisionesHeader
        año={año}
        onAñoChange={setAño}
        onNuevaComision={handleNuevaComision}
        totalComisiones={comisiones.length}
      />

      {loadingComisiones || loadingIntegrantes ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground animate-pulse">
          Cargando módulo de comisiones...
        </div>
      ) : (
        <ComisionesList
          comisiones={comisiones}
          integrantesMap={integrantesMap}
          año={año}
          onEditar={handleEditarComision}
          onAsignar={handleAsignarIntegrante}
        />
      )}

      <CrearEditarComisionModal
        open={crearEditarModalOpen}
        onOpenChange={setCrearEditarModalOpen}
        comisionEditar={comisionEditar}
      />

      <AsignarIntegranteModal
        open={asignarModalOpen}
        onOpenChange={setAsignarModalOpen}
        comision={comisionAsignar}
        año={año}
        integrantesActualesIds={integrantesActualesIds}
      />
    </div>
  );
}
