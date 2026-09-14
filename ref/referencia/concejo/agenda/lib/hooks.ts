"use client";

import { useQuery } from "@tanstack/react-query";
import { cargarAgendas } from "./acciones";

const FIVE_MINUTES = 1000 * 60 * 5;

export const CONCEJO_AGENDA_KEYS = {
  agendas: ["concejo-agendas"] as const,
};

export function useAgendasConcejo() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: CONCEJO_AGENDA_KEYS.agendas,
    queryFn: cargarAgendas,
    staleTime: FIVE_MINUTES,
  });

  return {
    agendas: data ?? [],
    cargando: isLoading,
    error: error
      ? "Ocurrió un error al cargar las agendas."
      : null,
    fetchAgendas: refetch,
  };
}
