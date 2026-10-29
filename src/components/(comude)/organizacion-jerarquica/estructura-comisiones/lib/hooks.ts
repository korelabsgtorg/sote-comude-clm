import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listarComisiones,
  crearComision,
  editarComision,
  alternarEstadoComision,
  listarIntegrantesPorAnio,
  asignarIntegrante,
  eliminarIntegrante,
  listarPersonasElegibles,
  listarPlanesTrabajoPorAnio,
  cambiarCoordinadorComision,
} from "./actions";
import type { ComisionFormValues, AsignarIntegranteValues } from "./zod";

export const COMISIONES_QUERY_KEY = ["comisiones"];
export const COMISION_INTEGRANTES_QUERY_KEY = ["comision_integrantes"];
export const PERSONAS_ELEGIBLES_QUERY_KEY = ["personas_elegibles_comision"];
export const COMISION_PLANES_QUERY_KEY = ["comision_planes_trabajo"];

export function usePlanesTrabajoComisiones(año: number) {
  return useQuery({
    queryKey: [...COMISION_PLANES_QUERY_KEY, año],
    queryFn: async () => {
      const res = await listarPlanesTrabajoPorAnio(año);
      if (res.error) throw new Error(res.error);
      return res.data ?? {};
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useComisiones() {
  return useQuery({
    queryKey: COMISIONES_QUERY_KEY,
    queryFn: async () => {
      const res = await listarComisiones();
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useIntegrantesComisiones(año: number) {
  return useQuery({
    queryKey: [...COMISION_INTEGRANTES_QUERY_KEY, año],
    queryFn: async () => {
      const res = await listarIntegrantesPorAnio(año);
      if (res.error) throw new Error(res.error);
      return res.data ?? {};
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function usePersonasElegibles() {
  return useQuery({
    queryKey: PERSONAS_ELEGIBLES_QUERY_KEY,
    queryFn: async () => {
      const res = await listarPersonasElegibles();
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useCrearComision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ComisionFormValues) => crearComision(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMISIONES_QUERY_KEY });
    },
  });
}

export function useEditarComision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ComisionFormValues }) =>
      editarComision(id, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMISIONES_QUERY_KEY });
    },
  });
}

export function useAlternarEstadoComision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nuevoEstado }: { id: string; nuevoEstado: boolean }) =>
      alternarEstadoComision(id, nuevoEstado),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMISIONES_QUERY_KEY });
    },
  });
}

export function useAsignarIntegrante() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comisionId,
      values,
    }: {
      comisionId: string;
      values: AsignarIntegranteValues;
    }) => asignarIntegrante(comisionId, values),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...COMISION_INTEGRANTES_QUERY_KEY, variables.values.año],
      });
    },
  });
}

export function useEliminarIntegrante(año: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (idAsignacion: string) => eliminarIntegrante(idAsignacion),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMISION_INTEGRANTES_QUERY_KEY, año],
      });
      void queryClient.invalidateQueries({
        queryKey: COMISIONES_QUERY_KEY,
      });
    },
  });
}

export function useCambiarCoordinadorComision(año: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      comisionId: string;
      año: number;
      nuevoCoordinadorIntegranteId: string;
    }) => cambiarCoordinadorComision(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMISION_INTEGRANTES_QUERY_KEY, año],
      });
      void queryClient.invalidateQueries({
        queryKey: COMISIONES_QUERY_KEY,
      });
    },
  });
}
