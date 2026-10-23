"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  obtenerDatosGestor,
  crearTarea,
  actualizarTarea,
  updateChecklist,
  cambiarEstado,
  eliminarTarea,
  duplicarTarea,
  actualizarArchivosTarea,
  agregarMiembro,
  eliminarMiembro,
  actualizarAsignacionesMiembro,
  actualizarComentarioMiembro,
  marcarParteMiembroCompletada,
  marcarComoRevisado,
  obtenerActividadPendienteConfirmacion,
} from "./actions";
import {
  TipoVistaTareas,
  NewTaskState,
  ChecklistItem,
  ArchivoAdjunto,
  AsignacionMiembro,
  ActualizarTareaInput,
} from "./zod";

export const TAREAS_KEYS = {
  gestor: (vista: string) => ["gestor-tareas", vista],
  all: ["gestor-tareas"],
  pendiente: ["bloqueo-actividad-pendiente"],
};

const KEYS = TAREAS_KEYS;

const FIVE_MINUTES = 1000 * 60 * 5;

export const useGestorData = (tipoVista: TipoVistaTareas, initialData: any) => {
  return useQuery({
    queryKey: KEYS.gestor(tipoVista),
    queryFn: () => obtenerDatosGestor(tipoVista),
    initialData,
    staleTime: FIVE_MINUTES,
  });
};

export const useTareaMutations = () => {
  const queryClient = useQueryClient();

  const invalidar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: TAREAS_KEYS.all }),
      queryClient.invalidateQueries({ queryKey: TAREAS_KEYS.pendiente }),
    ]);
  };

  const crear = useMutation({
    mutationFn: async (data: NewTaskState) => {
      const res = await crearTarea(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidar,
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ActualizarTareaInput }) => {
      const res = await actualizarTarea(id, updates);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  const actualizarChecklist = useMutation({
    mutationFn: async ({ id, items }: { id: string; items: ChecklistItem[] }) => {
      const res = await updateChecklist(id, items);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onMutate: async ({ id, items }) => {
      await queryClient.cancelQueries({ queryKey: TAREAS_KEYS.all });
      const previousQueries = queryClient.getQueriesData({ queryKey: TAREAS_KEYS.all });

      queryClient.setQueriesData({ queryKey: TAREAS_KEYS.all }, (old: any) => {
        if (!old || !old.tareas || !Array.isArray(old.tareas)) return old;
        return {
          ...old,
          tareas: old.tareas.map((t: any) => (t.id === id ? { ...t, checklist: items } : t)),
        };
      });

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      invalidar();
    },
  });

  const cambiarStatus = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const res = await cambiarEstado(id, estado);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onMutate: async ({ id, estado }) => {
      await queryClient.cancelQueries({ queryKey: TAREAS_KEYS.all });
      const previousQueries = queryClient.getQueriesData({ queryKey: TAREAS_KEYS.all });

      queryClient.setQueriesData({ queryKey: TAREAS_KEYS.all }, (old: any) => {
        if (!old || !old.tareas || !Array.isArray(old.tareas)) return old;
        return {
          ...old,
          tareas: old.tareas.map((t: any) => (t.id === id ? { ...t, status: estado } : t)),
        };
      });

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      invalidar();
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const res = await eliminarTarea(id);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  const duplicar = useMutation({
    mutationFn: async (data: NewTaskState) => {
      const res = await duplicarTarea(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidar,
  });

  const actualizarArchivos = useMutation({
    mutationFn: async ({ id, archivos }: { id: string; archivos: ArchivoAdjunto[] }) => {
      const res = await actualizarArchivosTarea(id, archivos);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  // ── Miembros grupales ──────────────────────────────────────────────────────

  const addMiembro = useMutation({
    mutationFn: async ({
      taskId,
      userId,
      asignaciones,
      tituloTarea,
    }: {
      taskId: string;
      userId: string;
      asignaciones: AsignacionMiembro[];
      tituloTarea: string;
    }) => {
      const res = await agregarMiembro(taskId, userId, asignaciones, tituloTarea);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  const removeMiembro = useMutation({
    mutationFn: async (miembroId: string) => {
      const res = await eliminarMiembro(miembroId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  const actualizarAsignaciones = useMutation({
    mutationFn: async ({
      miembroId,
      asignaciones,
    }: {
      miembroId: string;
      asignaciones: AsignacionMiembro[];
    }) => {
      const res = await actualizarAsignacionesMiembro(miembroId, asignaciones);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onMutate: async ({ miembroId, asignaciones }) => {
      await queryClient.cancelQueries({ queryKey: TAREAS_KEYS.all });
      const previousQueries = queryClient.getQueriesData({ queryKey: TAREAS_KEYS.all });

      queryClient.setQueriesData({ queryKey: TAREAS_KEYS.all }, (old: any) => {
        if (!old || !old.tareas || !Array.isArray(old.tareas)) return old;
        return {
          ...old,
          tareas: old.tareas.map((t: any) => {
            if (!t.miembros || !Array.isArray(t.miembros)) return t;
            const tieneMiembro = t.miembros.some((m: any) => m.id === miembroId);
            if (!tieneMiembro) return t;
            return {
              ...t,
              miembros: t.miembros.map((m: any) =>
                m.id === miembroId ? { ...m, asignaciones } : m
              ),
            };
          }),
        };
      });

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      invalidar();
    },
  });

  const actualizarComentario = useMutation({
    mutationFn: async ({ miembroId, comentario }: { miembroId: string; comentario: string }) => {
      const res = await actualizarComentarioMiembro(miembroId, comentario);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  const completarParteMiembro = useMutation({
    mutationFn: async (miembroId: string) => {
      const res = await marcarParteMiembroCompletada(miembroId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  const marcarRevisado = useMutation({
    mutationFn: async (id: string) => {
      const res = await marcarComoRevisado(id);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidar,
  });

  return {
    crear,
    actualizar,
    actualizarChecklist,
    cambiarStatus,
    eliminar,
    duplicar,
    actualizarArchivos,
    addMiembro,
    removeMiembro,
    actualizarAsignaciones,
    actualizarComentario,
    completarParteMiembro,
    marcarRevisado,
  };
};

export function useActividadPendiente() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: TAREAS_KEYS.pendiente,
    queryFn: async () => {
      const res = await obtenerActividadPendienteConfirmacion();
      return res.success ? res.data : null;
    },
    staleTime: 1000 * 10,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  return {
    data: data ?? null,
    isLoading,
    refetch,
  };
}

export const useActividadMutations = useTareaMutations;