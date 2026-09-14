import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";
import {
  ActComude,
  ActComudeConParticipantes,
  ActComudeRegistro,
  ActComudePunto,
  ActComudeCategoria,
  ActComudeArchivo,
  CrearActividadValues,
  RegistroAsistenciaValues,
  CrearPuntoValues,
} from "./zod";
import {
  getActividades,
  getActividadById,
  getRegistrosAsistencia,
  crearActividadComude,
  eliminarActividadComude,
  registrarAsistencia,
  actualizarAgendaActividad,
  editarActividadComude,
  actualizarActaActividad,
  actualizarImagenesActividad,
  // Nuevos
  getPuntosDeActividad,
  crearPunto,
  actualizarPunto,
  actualizarEstadoPunto,
  actualizarVotacionPunto,
  actualizarNotasPunto,
  eliminarPunto,
  getCategorias,
  crearCategoria,
  crearArchivoPunto,
  eliminarArchivoPunto,
  actualizarEstadoSesion,
} from "./actions";

// ----- QUERIES -----

export function useActividades(year?: number, month?: number) {
  return useQuery<ActComudeConParticipantes[], Error>({
    queryKey: ["actividades-comude", year, month],
    queryFn: () => getActividades(year, month),
    staleTime: 1000 * 60 * 5,
  });
}

export function useActividadById(id: string | null) {
  return useQuery<ActComudeConParticipantes | null, Error>({
    queryKey: ["actividad-comude", id],
    queryFn: () => getActividadById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRegistrosAsistencia(actComudeId: string | null) {
  return useQuery<ActComudeRegistro[], Error>({
    queryKey: ["registros-asistencia", actComudeId],
    queryFn: () => getRegistrosAsistencia(actComudeId!),
    enabled: !!actComudeId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Hook reactivo del cliente que escucha si el usuario actual es participante de la actividad */
export function useEsParticipante(actComudeId: string | null, userId: string | null | undefined) {
  const supabase = createClient();
  return useQuery<boolean, Error>({
    queryKey: ["es-participante", actComudeId, userId],
    queryFn: async () => {
      if (!actComudeId || !userId) return false;
      const { data } = await supabase
        .from("act_comude_participantes")
        .select("usuario_id")
        .eq("act_comude_id", actComudeId)
        .eq("usuario_id", userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!actComudeId && !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSignedUrl(path: string | null, bucket: string = "portada_imagenes") {
  const supabase = createClient();
  return useQuery<string | null, Error>({
    queryKey: ["signed-url", bucket, path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600 * 24);
      if (error) throw error;
      return data?.signedUrl || null;
    },
    enabled: !!path,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

// ----- MUTATIONS -----

export function useCrearActividad() {
  const queryClient = useQueryClient();
  return useMutation<{ id: string }, Error, CrearActividadValues>({
    mutationFn: (values) => crearActividadComude(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
    },
  });
}

export function useEditarActividad() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; values: CrearActividadValues }>({
    mutationFn: ({ id, values }) => editarActividadComude(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude"] });
    },
  });
}

export function useEliminarActividad() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => eliminarActividadComude(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
    },
  });
}

export function useRegistrarAsistencia() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, RegistroAsistenciaValues>({
    mutationFn: (values) => registrarAsistencia(values),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["registros-asistencia", variables.act_comude_id] });
    },
  });
}

export function useActualizarAgenda() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; agenda: any[] }>({
    mutationFn: ({ id, agenda }) => actualizarAgendaActividad(id, agenda),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
    },
  });
}

export function useActualizarActa() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; actaUrl: string | null }>({
    mutationFn: ({ id, actaUrl }) => actualizarActaActividad(id, actaUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude"] });
    },
  });
}

export function useActualizarImagenesActividad() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; imgPaths: string[] | null }>({
    mutationFn: ({ id, imgPaths }) => actualizarImagenesActividad(id, imgPaths),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
    },
  });
}

// ============================================================
// ----- HOOKS DE PUNTOS DE AGENDA -----
// ============================================================

export function usePuntosDeActividad(actComudeId: string | null) {
  return useQuery<ActComudePunto[], Error>({
    queryKey: ["puntos-comude", actComudeId],
    queryFn: () => getPuntosDeActividad(actComudeId!),
    enabled: !!actComudeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCrearPunto(actComudeId: string) {
  const queryClient = useQueryClient();
  return useMutation<ActComudePunto, Error, CrearPuntoValues>({
    mutationFn: (values) => crearPunto(actComudeId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", actComudeId] });
    },
  });
}

export function useActualizarPunto() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { puntoId: string; values: Partial<CrearPuntoValues>; actComudeId: string }>({
    mutationFn: ({ puntoId, values }) => actualizarPunto(puntoId, values),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

export function useActualizarEstadoPunto() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { puntoId: string; estado: string; actComudeId: string }>({
    mutationFn: ({ puntoId, estado }) => actualizarEstadoPunto(puntoId, estado),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

export function useActualizarVotacionPunto() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { puntoId: string; votacion: string; actComudeId: string }>({
    mutationFn: ({ puntoId, votacion }) => actualizarVotacionPunto(puntoId, votacion),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

export function useActualizarNotasPunto() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { puntoId: string; notas: string[]; actComudeId: string }>({
    mutationFn: ({ puntoId, notas }) => actualizarNotasPunto(puntoId, notas),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

export function useEliminarPunto() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { puntoId: string; actComudeId: string }>({
    mutationFn: ({ puntoId }) => eliminarPunto(puntoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

// ============================================================
// ----- HOOKS DE CATEGORÍAS -----
// ============================================================

export function useCategorias() {
  return useQuery<ActComudeCategoria[], Error>({
    queryKey: ["categorias-comude"],
    queryFn: getCategorias,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCrearCategoria() {
  const queryClient = useQueryClient();
  return useMutation<ActComudeCategoria, Error, string>({
    mutationFn: (nombre) => crearCategoria(nombre),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-comude"] });
    },
  });
}

// ============================================================
// ----- HOOKS DE ARCHIVOS POR PUNTO -----
// ============================================================

export function useCrearArchivoPunto() {
  const queryClient = useQueryClient();
  return useMutation<ActComudeArchivo, Error, { puntoId: string; nombre: string; filePath: string; actComudeId: string }>({
    mutationFn: ({ puntoId, nombre, filePath }) => crearArchivoPunto(puntoId, nombre, filePath),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

export function useEliminarArchivoPunto() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { archivoId: string; actComudeId: string }>({
    mutationFn: ({ archivoId }) => eliminarArchivoPunto(archivoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["puntos-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
    },
  });
}

// ============================================================
// ----- HOOK DE ESTADO DE SESIÓN -----
// ============================================================

export function useActualizarEstadoSesion() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { actComudeId: string; nuevoEstado: "Programada" | "En progreso" | "Finalizada" }>({
    mutationFn: ({ actComudeId, nuevoEstado }) => actualizarEstadoSesion(actComudeId, nuevoEstado),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["actividad-comude", variables.actComudeId] });
      queryClient.invalidateQueries({ queryKey: ["actividades-comude"] });
    },
  });
}

// ----- DIRECTORIO DE CONTACTOS -----

export type ContactoPerfil = {
  id: string;
  nombre: string;
  telefono: string | null;
  avatar_url: string | null;
  rol: string | null;
};

export function useContactos(isSuperViewer: boolean, options?: { enabled?: boolean }) {
  const supabase = createClient();
  return useQuery<ContactoPerfil[], Error>({
    queryKey: ["contactos-directorio", isSuperViewer],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, nombre, telefono, avatar_url, rol")
        .eq("activo", true)
        .order("nombre", { ascending: true });

      // ── Filtro por municipio ────────────────────────────────────────────
      if (isSuperViewer) {
        // Super: usa el municipio activo de la cookie global (cambia al moverse)
        const globalMun = await getGlobalMunicipioCookie();
        if (globalMun?.id) {
          query = query.eq("municipio_id", globalMun.id);
        } else {
          // Fallback: su propio municipio_id del perfil
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("municipio_id")
              .eq("id", user.id)
              .single();
            if (profile?.municipio_id) {
              query = query.eq("municipio_id", profile.municipio_id);
            }
          }
        }
      } else {
        // Admin / usuario normal: siempre su propio municipio + ocultar Supers
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("municipio_id")
            .eq("id", user.id)
            .single();
          if (profile?.municipio_id) {
            query = query.eq("municipio_id", profile.municipio_id);
          }
        }
        query = query.neq("rol", "super");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContactoPerfil[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
