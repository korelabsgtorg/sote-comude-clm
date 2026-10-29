import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listarMisComisionesPorAnio,
  listarTodasComisionesPorAnio,
  guardarPlanTrabajoComision,
  eliminarPlanTrabajoComision,
} from "./actions";

export const MIS_COMISIONES_QUERY_KEY = ["mis_comisiones"];
export const TODAS_COMISIONES_QUERY_KEY = ["todas_comisiones"];
export const COMISION_PLANES_QUERY_KEY = ["comision_planes_trabajo"];

export function useMisComisiones(año: number, enabled: boolean = true) {
  return useQuery({
    queryKey: [...MIS_COMISIONES_QUERY_KEY, año],
    queryFn: async () => {
      const res = await listarMisComisionesPorAnio(año);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useTodasComisiones(año: number, enabled: boolean = true) {
  return useQuery({
    queryKey: [...TODAS_COMISIONES_QUERY_KEY, año],
    queryFn: async () => {
      const res = await listarTodasComisionesPorAnio(año);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useGuardarPlanTrabajo(año: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      idComision: string;
      año: number;
      archivoPath: string;
      nombreArchivo?: string;
    }) => guardarPlanTrabajoComision(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...MIS_COMISIONES_QUERY_KEY, año],
      });
      void queryClient.invalidateQueries({
        queryKey: [...TODAS_COMISIONES_QUERY_KEY, año],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COMISION_PLANES_QUERY_KEY, año],
      });
    },
  });
}

export function useEliminarPlanTrabajo(año: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { idComision: string; año: number }) =>
      eliminarPlanTrabajoComision(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...MIS_COMISIONES_QUERY_KEY, año],
      });
      void queryClient.invalidateQueries({
        queryKey: [...TODAS_COMISIONES_QUERY_KEY, año],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COMISION_PLANES_QUERY_KEY, año],
      });
    },
  });
}
