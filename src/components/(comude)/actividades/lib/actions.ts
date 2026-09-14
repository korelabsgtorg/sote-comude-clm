"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import {
  CrearActividadValues,
  RegistroAsistenciaValues,
  ActComude,
  ActComudeConParticipantes,
  ActComudeRegistro,
  ActComudePunto,
  ActComudeCategoria,
  ActComudeArchivo,
  CrearPuntoValues,
} from "./zod";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";

// ----- LECTURA -----

// Helper para traer los perfiles manualmente
async function attachProfilesToActividades(actividades: any[], supabase: any) {
  const userIds = new Set<string>();
  actividades.forEach((act) => {
    (act.act_comude_participantes || []).forEach((p: any) => userIds.add(p.usuario_id));
  });

  if (userIds.size === 0) return actividades;

  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, nombre, rol")
    .in("id", Array.from(userIds));

  const mapPerfiles = new Map((perfiles || []).map((p: any) => [p.id, p]));

  return actividades.map((act) => ({
    ...act,
    act_comude_participantes: (act.act_comude_participantes || []).map((p: any) => ({
      ...p,
      profiles: mapPerfiles.get(p.usuario_id) || null,
    })),
  }));
}

/** Helper para obtener el municipio_id efectivo según el rol del usuario */
async function getEffectiveMunicipioId(supabase: any): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("municipio_id, rol")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const isSuper = profile.rol?.toLowerCase() === "super";

  if (isSuper) {
    const globalMun = await getGlobalMunicipioCookie();
    if (globalMun?.id) {
      return globalMun.id;
    }
    return profile.municipio_id ?? null;
  }

  return profile.municipio_id ?? null;
}

/** Obtiene las actividades COMUDE de un mes específico */
export async function getActividades(year?: number, month?: number): Promise<ActComudeConParticipantes[]> {
  const supabase = await createClient();

  const currentYear = year || new Date().getFullYear();
  const currentMonth = month !== undefined ? month : new Date().getMonth();

  const startDate = month === -1 
    ? new Date(currentYear, 0, 1).toISOString()
    : new Date(currentYear, currentMonth, 1).toISOString();
    
  const endDate = month === -1
    ? new Date(currentYear, 11, 31, 23, 59, 59, 999).toISOString()
    : new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

  let query = supabase
    .from("act_comude")
    .select(`
      *,
      act_comude_participantes (
        act_comude_id,
        usuario_id,
        encargado
      )
    `)
    .gte("fecha", startDate)
    .lte("fecha", endDate)
    .order("fecha", { ascending: true });

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("municipio_id, rol")
      .eq("id", user.id)
      .single();

    const isSuper = profile?.rol?.toLowerCase() === "super";

    if (isSuper) {
      const globalMun = await getGlobalMunicipioCookie();
      if (globalMun?.id) {
        query = query.eq("municipio_id", globalMun.id);
      } else if (profile?.municipio_id) {
        query = query.eq("municipio_id", profile.municipio_id);
      }
    } else {
      if (profile?.municipio_id) {
        query = query.eq("municipio_id", profile.municipio_id);
      } else {
        query = query.eq("municipio_id", -1);
      }
    }
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  
  const actividadesConPerfiles = await attachProfilesToActividades(data || [], supabase);
  return actividadesConPerfiles as ActComudeConParticipantes[];
}

/** Obtiene una actividad con sus participantes, perfiles y puntos de agenda */
export async function getActividadById(id: string): Promise<ActComudeConParticipantes | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("act_comude")
    .select(`
      *,
      act_comude_participantes (
        act_comude_id,
        usuario_id,
        encargado
      ),
      act_comude_puntos (
        *,
        categoria:act_comude_categorias(*),
        act_comude_archivos(*)
      )
    `)
    .eq("id", id)
    .order("orden", { referencedTable: "act_comude_puntos", ascending: true })
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const res = await attachProfilesToActividades([data], supabase);
  return res[0] as ActComudeConParticipantes;
}

/** Obtiene los registros de asistencia de una actividad */
export async function getRegistrosAsistencia(actComude_id: string): Promise<ActComudeRegistro[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("act_comude_registros")
    .select("*")
    .eq("act_comude_id", actComude_id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  
  const registros = data ?? [];
  if (registros.length === 0) return [];

  // Obtener nombres manualmente para evitar error de FK en Supabase
  const userIds = [...new Set(registros.map((r) => r.usuario_id))];
  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, nombre")
    .in("id", userIds);

  const mapNombres = new Map((perfiles || []).map((p) => [p.id, p.nombre]));

  return registros.map((r) => ({
    ...r,
    profiles: { nombre: mapNombres.get(r.usuario_id) ?? "Sin nombre" }
  })) as ActComudeRegistro[];
}

// ----- CREACIÓN / EDICIÓN -----

/** Crea una nueva actividad COMUDE y asigna participantes */
export async function crearActividadComude(values: CrearActividadValues): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const municipioId = await getEffectiveMunicipioId(supabase);

  // Insertar la actividad
  const { data: actividad, error: actError } = await supabase
    .from("act_comude")
    .insert({
      detalles_sesion: {
        titulo: values.titulo,
        acta: values.acta,
        libro: values.libro,
      },
      fecha: new Date(values.fecha).toISOString(),
      descripcion: values.descripcion ?? null,
      municipio_id: municipioId,
      estado: "Programada",
    })
    .select("id")
    .single();

  if (actError || !actividad) throw new Error(actError?.message ?? "Error al crear la actividad");

  // Insertar participantes
  const participantes = values.participantes.map((p) => ({
    act_comude_id: actividad.id,
    usuario_id: p.usuario_id,
    encargado: p.encargado,
  }));

  if (participantes.length > 0) {
    const { error: partError } = await supabase
      .from("act_comude_participantes")
      .insert(participantes);

    if (partError) throw new Error(partError.message);
  }

  revalidatePath("/comude");
  return { id: actividad.id };
}

/** Edita una actividad COMUDE existente */
export async function editarActividadComude(id: string, values: CrearActividadValues): Promise<void> {
  const supabase = await createClient();

  // Actualizar la actividad
  const { error: actError } = await supabase
    .from("act_comude")
    .update({
      detalles_sesion: {
        titulo: values.titulo,
        acta: values.acta,
        libro: values.libro,
      },
      fecha: new Date(values.fecha).toISOString(),
      descripcion: values.descripcion ?? null,
    })
    .eq("id", id);

  if (actError) throw new Error(actError.message);

  // Reemplazar participantes
  await supabase.from("act_comude_participantes").delete().eq("act_comude_id", id);

  const participantes = values.participantes.map((p) => ({
    act_comude_id: id,
    usuario_id: p.usuario_id,
    encargado: p.encargado,
  }));

  if (participantes.length > 0) {
    const { error: partError } = await supabase
      .from("act_comude_participantes")
      .insert(participantes);

    if (partError) throw new Error(partError.message);
  }

  revalidatePath("/comude");
}

/** Obsoleta: Ya no se usa la agenda de JSONB */
export async function actualizarAgendaActividad(id: string, agenda: any[]): Promise<void> {
  // Función mantenida solo para no romper imports antiguos temporalmente
}

/** Actualiza o guarda la URL del acta PDF en la base de datos */
export async function actualizarActaActividad(id: string, actaUrl: string | null): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("act_comude")
    .update({ acta: actaUrl ? [actaUrl] : null })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/comude");
}

/** Elimina una actividad COMUDE */
export async function eliminarActividadComude(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("act_comude").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/(comude)/actividades");
}

export async function actualizarImagenesActividad(id: string, imgPaths: string[] | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("act_comude")
    .update({ img: imgPaths })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/(comude)/actividades");
}

import { getGlobalSettings } from "@/components/(base)/(settings)/global/actions";

// ----- ASISTENCIA -----

/** Registra la asistencia (entrada o salida) de un usuario con su ubicación GPS */
export async function registrarAsistencia(values: RegistroAsistenciaValues): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Validación de tiempo y justificación
  const { data: actividad } = await supabase
    .from("act_comude")
    .select("fecha")
    .eq("id", values.act_comude_id)
    .single();

  if (!actividad) throw new Error("Actividad no encontrada");

  const settings = await getGlobalSettings();
  if (settings) {
    const ahora = new Date().getTime();
    const horaProgramada = new Date(actividad.fecha).getTime();
    const minDespues = settings.minutos_despues_permitidos * 60000;
    const minAntes = settings.minutos_antes_permitidos * 60000;

    if (values.tipo_registro === "entrada" && ahora < horaProgramada - minAntes) {
      throw new Error("Es muy temprano para marcar asistencia");
    }

    if (values.tipo_registro === "entrada" && ahora > horaProgramada + minDespues && (!values.notas || values.notas.trim().length < 5)) {
      throw new Error("Se requiere una justificación válida para el registro tardío");
    }
  }

  const { error } = await supabase.from("act_comude_registros").insert({
    act_comude_id: values.act_comude_id,
    usuario_id: user.id,
    tipo_registro: values.tipo_registro,
    ubicacion: {
      lat: values.latitud,
      lng: values.longitud,
      accuracy: values.accuracy,
    },
    notas: values.notas ?? null,
  });

  if (error) throw new Error(error.message);
}

// ============================================================
// ----- PUNTOS DE AGENDA (act_comude_puntos) -----
// ============================================================

/** Obtiene todos los puntos de agenda de una actividad, ordenados */
export async function getPuntosDeActividad(actComudeId: string): Promise<ActComudePunto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("act_comude_puntos")
    .select(`
      *,
      categoria:act_comude_categorias(*),
      act_comude_archivos(*)
    `)
    .eq("act_comude_id", actComudeId)
    .order("orden", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ActComudePunto[];
}

/** Crea un nuevo punto de agenda */
export async function crearPunto(actComudeId: string, values: CrearPuntoValues): Promise<ActComudePunto> {
  const supabase = await createClient();

  // Calcular el siguiente número de orden
  const { count } = await supabase
    .from("act_comude_puntos")
    .select("*", { count: "exact", head: true })
    .eq("act_comude_id", actComudeId);

  const { data, error } = await supabase
    .from("act_comude_puntos")
    .insert({
      act_comude_id: actComudeId,
      titulo: values.titulo,
      categoria_id: values.categoria_id ?? null,
      estado: values.estado ?? "No iniciado",
      votacion: values.votacion ?? "No emitido",
      notas: values.notas ?? null,
      orden: (count ?? 0) + 1,
    })
    .select(`*, categoria:act_comude_categorias(*), act_comude_archivos(*)`)
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/comude");
  return data as ActComudePunto;
}

/** Actualiza un punto de agenda */
export async function actualizarPunto(
  puntoId: string,
  values: Partial<CrearPuntoValues>
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("act_comude_puntos")
    .update({
      titulo: values.titulo,
      categoria_id: values.categoria_id,
      estado: values.estado,
      votacion: values.votacion,
      notas: values.notas,
    })
    .eq("id", puntoId);

  if (error) throw new Error(error.message);
  revalidatePath("/comude");
}

/** Actualiza solo el estado de un punto */
export async function actualizarEstadoPunto(puntoId: string, estado: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("act_comude_puntos")
    .update({ estado })
    .eq("id", puntoId);

  if (error) throw new Error(error.message);
  revalidatePath("/comude");
}

/** Actualiza solo la votación de un punto */
export async function actualizarVotacionPunto(puntoId: string, votacion: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("act_comude_puntos")
    .update({ votacion })
    .eq("id", puntoId);

  if (error) throw new Error(error.message);
  revalidatePath("/comude");
}

/** Actualiza las notas de un punto */
export async function actualizarNotasPunto(puntoId: string, notas: string[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("act_comude_puntos")
    .update({ notas })
    .eq("id", puntoId);

  if (error) throw new Error(error.message);
  revalidatePath("/comude");
}

/** Elimina un punto de agenda */
export async function eliminarPunto(puntoId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("act_comude_puntos").delete().eq("id", puntoId);
  if (error) throw new Error(error.message);
  revalidatePath("/comude");
}

// ============================================================
// ----- CATEGORÍAS (act_comude_categorias) -----
// ============================================================

/** Obtiene todas las categorías disponibles para el municipio actual */
export async function getCategorias(): Promise<ActComudeCategoria[]> {
  const supabase = await createClient();
  const municipioId = await getEffectiveMunicipioId(supabase);

  let query = supabase.from("act_comude_categorias").select("*");

  if (municipioId) {
    query = query.eq("municipio_id", municipioId);
  } else {
    query = query.is("municipio_id", null);
  }

  const { data, error } = await query.order("nombre", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ActComudeCategoria[];
}

/** Crea una nueva categoría para el municipio actual */
export async function crearCategoria(nombre: string): Promise<ActComudeCategoria> {
  const supabase = await createClient();
  const municipioId = await getEffectiveMunicipioId(supabase);

  const { data, error } = await supabase
    .from("act_comude_categorias")
    .insert({ nombre, municipio_id: municipioId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ActComudeCategoria;
}

// ============================================================
// ----- ARCHIVOS POR PUNTO (act_comude_archivos) -----
// ============================================================

/** Obtiene los archivos adjuntos de un punto */
export async function getArchivosDePunto(puntoId: string): Promise<ActComudeArchivo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("act_comude_archivos")
    .select("*")
    .eq("punto_id", puntoId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ActComudeArchivo[];
}

/** Adjunta un archivo a un punto de agenda */
export async function crearArchivoPunto(
  puntoId: string,
  nombre: string,
  filePath: string
): Promise<ActComudeArchivo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("act_comude_archivos")
    .insert({ punto_id: puntoId, nombre, file_path: filePath })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ActComudeArchivo;
}

/** Elimina un archivo adjunto de un punto */
export async function eliminarArchivoPunto(archivoId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("act_comude_archivos").delete().eq("id", archivoId);
  if (error) throw new Error(error.message);
}

// ============================================================
// ----- ESTADO DE LA SESIÓN (act_comude.estado) -----
// ============================================================

/** Apertura o cierra la sesión actualizando el estado e inicio/fin */
export async function actualizarEstadoSesion(
  actComudeId: string,
  nuevoEstado: "Programada" | "En progreso" | "Finalizada"
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, string | null> = { estado: nuevoEstado };
  const ahora = new Date().toISOString();

  if (nuevoEstado === "En progreso") {
    updates.inicio = ahora;
    updates.fin = null;
  } else if (nuevoEstado === "Finalizada") {
    updates.fin = ahora;
  } else if (nuevoEstado === "Programada") {
    updates.inicio = null;
    updates.fin = null;
  }

  const { error } = await supabase
    .from("act_comude")
    .update(updates)
    .eq("id", actComudeId);

  if (error) throw new Error(error.message);
  revalidatePath("/comude");
}
