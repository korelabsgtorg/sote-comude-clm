"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEstructuraTerritorial,
  createComunidad,
  updateComunidad,
  deleteComunidad,
  getPersonasParaAsignarTerritorio,
  asignarPersonaATerritorio,
  getResolucionVigenteComunidad,
  getHistorialResolucionesComunidad,
  renovarResolucionCOCODE,
  editarResolucionCOCODE,
} from "./actions";
import type { ComunidadFormValues, AsignarPersonaComunidadValues } from "./zod";

const TERRITORIAL_KEY = ["estructura-territorial"];
const PERSONAS_TERRITORIO_KEY = ["personas-territorio"];

export function useEstructuraTerritorial() {
  return useQuery({
    queryKey: TERRITORIAL_KEY,
    queryFn: getEstructuraTerritorial,
  });
}

function useInvalidateTerritorial() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: TERRITORIAL_KEY });
    queryClient.invalidateQueries({ queryKey: PERSONAS_TERRITORIO_KEY });
  };
}

export function useCrearComunidad() {
  const invalidate = useInvalidateTerritorial();
  return useMutation({
    mutationFn: (values: ComunidadFormValues) => createComunidad(values),
    onSuccess: invalidate,
  });
}

export function useEditarComunidad() {
  const invalidate = useInvalidateTerritorial();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ComunidadFormValues }) =>
      updateComunidad(id, values),
    onSuccess: invalidate,
  });
}

export function useEliminarComunidad() {
  const invalidate = useInvalidateTerritorial();
  return useMutation({
    mutationFn: (id: string) => deleteComunidad(id),
    onSuccess: invalidate,
  });
}

export function usePersonasParaAsignarTerritorio(comunidadId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PERSONAS_TERRITORIO_KEY, comunidadId],
    queryFn: () => getPersonasParaAsignarTerritorio(comunidadId!),
    enabled: enabled && Boolean(comunidadId),
  });
}

export function useAsignarPersonaATerritorio() {
  const invalidate = useInvalidateTerritorial();
  return useMutation({
    mutationFn: (values: AsignarPersonaComunidadValues) => asignarPersonaATerritorio(values),
    onSuccess: invalidate,
  });
}

// ─── Resoluciones COCODE Hooks ──────────────────────────────────────────────

const RESOLUCION_KEY = ["resolucion-cocode"];

export function useResolucionVigente(comunidadId: string | null) {
  return useQuery({
    queryKey: [...RESOLUCION_KEY, "vigente", comunidadId],
    queryFn: () => getResolucionVigenteComunidad(comunidadId!),
    enabled: Boolean(comunidadId),
  });
}

export function useHistorialResoluciones(comunidadId: string | null) {
  return useQuery({
    queryKey: [...RESOLUCION_KEY, "historial", comunidadId],
    queryFn: () => getHistorialResolucionesComunidad(comunidadId!),
    enabled: Boolean(comunidadId),
  });
}

export function useRenovarResolucion() {
  const queryClient = useQueryClient();
  const invalidateTerritorial = useInvalidateTerritorial();
  return useMutation({
    mutationFn: renovarResolucionCOCODE,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOLUCION_KEY });
      invalidateTerritorial();
    },
  });
}

export function useEditarResolucion() {
  const queryClient = useQueryClient();
  const invalidateTerritorial = useInvalidateTerritorial();
  return useMutation({
    mutationFn: editarResolucionCOCODE,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOLUCION_KEY });
      invalidateTerritorial();
    },
  });
}


