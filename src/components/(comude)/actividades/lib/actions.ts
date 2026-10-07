"use server";

import { createClient } from "@/utils/supabase/server";
import { sendPushToUsers } from "@/utils/push-utils";
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
import { extractUuid, slugify } from "./slug";

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
        encargado,
        confirmed_at,
        created_by
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
  if (!data || data.length === 0) return [];
  
  const actividadesConPerfiles = await attachProfilesToActividades(data, supabase);
  return actividadesConPerfiles as ActComudeConParticipantes[];
}

/** Obtiene una actividad con sus participantes, perfiles y puntos de agenda (admite UUID o slug de título) */
export async function getActividadById(idOrSlug: string): Promise<ActComudeConParticipantes | null> {
  const supabase = await createClient();
  const uuidMatch = idOrSlug.match(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  const realId = uuidMatch ? uuidMatch[1] : null;

  let query = supabase
    .from("act_comude")
    .select(`
      *,
      act_comude_participantes (
        act_comude_id,
        usuario_id,
        encargado,
        confirmed_at,
        created_by
      ),
      act_comude_puntos (
        *,
        categoria:act_comude_categorias(*),
        act_comude_archivos(*)
      )
    `)
    .order("orden", { referencedTable: "act_comude_puntos", ascending: true });

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("municipio_id, rol")
      .eq("id", user.id)
      .single();

    if (profile?.municipio_id) {
      query = query.eq("municipio_id", profile.municipio_id);
    }
  }

  if (realId) {
    query = query.eq("id", realId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error || !data) return null;
    const res = await attachProfilesToActividades([data], supabase);
    return res[0] as ActComudeConParticipantes;
  }

  // Búsqueda por slug limpio sin UUID
  const { data: actividades, error } = await query;
  if (error || !actividades || actividades.length === 0) return null;

  const target = actividades.find((act: any) => {
    const titulo = act.detalles_sesion?.titulo || "";
    return slugify(titulo) === idOrSlug || act.id === idOrSlug;
  });

  if (!target) return null;

  const res = await attachProfilesToActividades([target], supabase);
  return res[0] as ActComudeConParticipantes;
}

/** Obtiene los registros de asistencia de una actividad */
export async function getRegistrosAsistencia(actComude_id: string): Promise<ActComudeRegistro[]> {
  const supabase = await createClient();
  const realId = extractUuid(actComude_id);
  const { data, error } = await supabase
    .from("act_comude_registros")
    .select("*")
    .eq("act_comude_id", realId)
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
      ubicacion: values.ubicacion?.trim() || "Gimnasio Municipal",
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
    created_by: user.id,
    confirmed_at: null,
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

/** Emite oficialmente la convocatoria para una actividad COMUDE, enviando push y activando la confirmación de asistencia */
export async function emitirConvocatoriaComude(actComudeId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Obtener la actividad y sus participantes
  const { data: actividad, error: actErr } = await supabase
    .from("act_comude")
    .select(`
      id,
      detalles_sesion,
      act_comude_participantes (usuario_id)
    `)
    .eq("id", actComudeId)
    .single();

  if (actErr || !actividad) throw new Error("Actividad no encontrada");

  const titulo = (actividad.detalles_sesion as any)?.titulo || "Sesión COMUDE";

  // Actualizar la columna convocatoria
  const { error: updateErr } = await supabase
    .from("act_comude")
    .update({
      convocatoria: {
        emitida: true,
        created_at: new Date().toISOString(),
      },
    })
    .eq("id", actComudeId);

  if (updateErr) throw new Error(updateErr.message);

  // Disparar notificaciones PUSH a los participantes (excluyendo al creador/admin que la emitió)
  const targetIds = (actividad.act_comude_participantes || [])
    .map((p: any) => p.usuario_id)
    .filter((uid: string) => uid !== user.id);

  if (targetIds.length > 0) {
    try {
      await sendPushToUsers(targetIds, {
        title: "📋 Convocatoria COMUDE Emitida",
        body: `Se ha publicado la convocatoria oficial para: ${titulo}`,
        url: `/comude/actividades/${actComudeId}`,
      });
    } catch (pushErr) {
      console.error("Error enviando push al emitir convocatoria:", pushErr);
    }
  }

  revalidatePath("/comude");
}

/** Edita una actividad COMUDE existente */
export async function editarActividadComude(id: string, values: CrearActividadValues): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Obtener la fecha, ubicación y participantes previos con sus confirmaciones
  const { data: actividadPrevia } = await supabase
    .from("act_comude")
    .select(`
      fecha,
      ubicacion,
      act_comude_participantes (
        usuario_id,
        confirmed_at
      )
    `)
    .eq("id", id)
    .single();

  const nuevaFechaIso = new Date(values.fecha).toISOString();
  const cambioDeFecha = actividadPrevia
    ? new Date(actividadPrevia.fecha).getTime() !== new Date(nuevaFechaIso).getTime()
    : false;

  const nuevaUbicacion = values.ubicacion?.trim() || "Gimnasio Municipal";
  const ubicacionPrevia = actividadPrevia?.ubicacion?.trim() || "Gimnasio Municipal";
  const cambioDeLugar = actividadPrevia
    ? ubicacionPrevia.toLowerCase() !== nuevaUbicacion.toLowerCase()
    : false;

  const requiereNotificacion = cambioDeFecha || cambioDeLugar;

  // Mapa de confirmaciones previas por usuario_id
  const confirmedMap = new Map<string, string | null>();
  if (actividadPrevia?.act_comude_participantes) {
    (actividadPrevia.act_comude_participantes as any[]).forEach((p) => {
      confirmedMap.set(p.usuario_id, p.confirmed_at);
    });
  }

  // Actualizar la actividad
  const { error: actError } = await supabase
    .from("act_comude")
    .update({
      detalles_sesion: {
        titulo: values.titulo,
        acta: values.acta,
        libro: values.libro,
      },
      fecha: nuevaFechaIso,
      descripcion: values.descripcion ?? null,
      ubicacion: nuevaUbicacion,
    })
    .eq("id", id);

  if (actError) throw new Error(actError.message);

  // Reemplazar participantes respetando confirmaciones existentes si no cambió la fecha ni el lugar
  await supabase.from("act_comude_participantes").delete().eq("act_comude_id", id);

  const participantes = values.participantes.map((p) => {
    const confirmedAtPrevio = confirmedMap.get(p.usuario_id);
    return {
      act_comude_id: id,
      usuario_id: p.usuario_id,
      encargado: p.encargado,
      created_by: user?.id ?? null,
      confirmed_at: requiereNotificacion ? null : (confirmedAtPrevio ?? null),
    };
  });

  if (participantes.length > 0) {
    const { error: partError } = await supabase
      .from("act_comude_participantes")
      .insert(participantes);

    if (partError) throw new Error(partError.message);

    // Solo enviar notificación PUSH cuando se edite la fecha o el lugar de la reunión
    if (requiereNotificacion) {
      const targetIds = values.participantes.map((p) => p.usuario_id);

      if (targetIds.length > 0) {
        const fechaFormateada = new Date(values.fecha).toLocaleDateString("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        let pushTitle = "📅 Cambio en Reunión de COMUDE";
        let pushBody = "";

        if (cambioDeFecha && cambioDeLugar) {
          pushTitle = "📅📍 Cambio de Fecha y Lugar";
          pushBody = `Se ha modificado la fecha y lugar de la reunión a ${fechaFormateada} en "${nuevaUbicacion}". Por favor confirma de enterado.`;
        } else if (cambioDeFecha) {
          pushTitle = "📅 Cambio de Fecha de Reunión";
          pushBody = `Se ha modificado la fecha de la reunión a ${fechaFormateada}. Por favor confirma de enterado.`;
        } else if (cambioDeLugar) {
          pushTitle = "📍 Cambio de Lugar de Reunión";
          pushBody = `Se ha modificado el lugar de la reunión a: "${nuevaUbicacion}". Por favor confirma de enterado.`;
        }

        try {
          await sendPushToUsers(targetIds, {
            title: pushTitle,
            body: pushBody,
            url: `/comude`,
          });
        } catch (pushErr) {
          console.error("Error enviando push tras editar actividad:", pushErr);
        }
      }
    }
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

// ============================================================
// ----- CONFIRMACIÓN OBLIGATORIA DE ACTIVIDADES -----
// ============================================================

export type ActividadPendienteConfirmacion = {
  participanteId?: string;
  actComudeId: string;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  fecha: string;
  creadorNombre: string | null;
  fechaAsignacion: string | null;
};

/**
 * Consulta si el usuario actualmente autenticado tiene actividades asignadas no confirmadas (confirmed_at IS NULL).
 */
export async function getActividadPendienteConfirmacion(): Promise<ActividadPendienteConfirmacion | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Consultar participantes no confirmados del usuario
  const { data: asignaciones, error } = await supabase
    .from("act_comude_participantes")
    .select(`
      act_comude_id,
      usuario_id,
      confirmed_at,
      created_by,
      act_comude!inner (
        id,
        detalles_sesion,
        descripcion,
        ubicacion,
        fecha,
        estado,
        convocatoria
      )
    `)
    .eq("usuario_id", user.id)
    .is("confirmed_at", null)
    .limit(10);

  if (error || !asignaciones || asignaciones.length === 0) {
    return null;
  }

  // Filtrar asignaciones cuya actividad siga activa (no cancelada/finalizada) y cuya convocatoria haya sido emitida
  const asignacionValida = asignaciones.find((asig: any) => {
    const act = asig.act_comude;
    const estado = (act?.estado || "").toLowerCase();
    const convocatoriaEmitida = Boolean(
      act?.convocatoria && (act.convocatoria.emitida || act.convocatoria.created_at)
    );
    return estado !== "cancelada" && estado !== "finalizada" && convocatoriaEmitida;
  });

  if (!asignacionValida) return null;

  const act = (asignacionValida as any).act_comude;
  const creadorId = (asignacionValida as any).created_by;

  let creadorNombre: string | null = null;
  if (creadorId) {
    const { data: perfilCreador } = await supabase
      .from("profiles")
      .select("nombre")
      .eq("id", creadorId)
      .single();
    if (perfilCreador) {
      creadorNombre = perfilCreador.nombre;
    }
  }

  const detalles = act?.detalles_sesion || {};

  return {
    actComudeId: act.id,
    titulo: detalles.titulo || "Nueva Actividad COMUDE",
    descripcion: act.descripcion || null,
    ubicacion: act.ubicacion || "Gimnasio Municipal",
    fecha: act.fecha,
    creadorNombre,
    fechaAsignacion: null,
  };
}

/**
 * Registra la confirmación de enterado para el usuario autenticado en la actividad especificada.
 */
export async function confirmarParticipacionComude(actComudeId: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("act_comude_participantes")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("act_comude_id", actComudeId)
    .eq("usuario_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/comude");
}

/**
 * Sustituye al usuario actual (o especificado) por un nuevo usuario participante en una sesión de COMUDE.
 * Envía notificación PUSH al nuevo usuario asignado.
 */
export async function sustituirParticipanteComude(params: {
  actComudeId: string;
  nuevoUsuarioId: string;
}): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  // 1. Obtener la asignación actual del participante autenticado
  const { data: participanteActual, error: errorPart } = await supabase
    .from("act_comude_participantes")
    .select("encargado")
    .eq("act_comude_id", params.actComudeId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (errorPart || !participanteActual) {
    throw new Error("No eres participante registrado en esta sesión de COMUDE.");
  }

  // 2. Obtener datos de la actividad y del usuario sustituto
  const [{ data: actividad }, { data: perfilActual }] = await Promise.all([
    supabase
      .from("act_comude")
      .select("id, detalles_sesion, fecha, ubicacion")
      .eq("id", params.actComudeId)
      .single(),
    supabase
      .from("profiles")
      .select("nombre")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // 3. Eliminar la participación del titular actual
  const { error: errorDel } = await supabase
    .from("act_comude_participantes")
    .delete()
    .eq("act_comude_id", params.actComudeId)
    .eq("usuario_id", user.id);

  if (errorDel) throw new Error(errorDel.message);

  // 4. Insertar la nueva asignación para el sustituto (requerirá confirmación)
  const { error: errorIns } = await supabase
    .from("act_comude_participantes")
    .upsert({
      act_comude_id: params.actComudeId,
      usuario_id: params.nuevoUsuarioId,
      encargado: participanteActual.encargado,
      created_by: user.id,
      confirmed_at: null, // Requiere que el sustituto confirme enterado
    });

  if (errorIns) throw new Error(errorIns.message);

  // 5. Enviar notificación push al sustituto
  const delegadorNombre = perfilActual?.nombre || "Un titular de jefatura";
  const tituloSesion = actividad?.detalles_sesion?.titulo || "Reunión de COMUDE";

  try {
    await sendPushToUsers([params.nuevoUsuarioId], {
      title: "📋 Has sido delegado al COMUDE",
      body: `${delegadorNombre} te ha asignado como sustituto para asistir a: "${tituloSesion}".`,
      url: `/comude`,
    });
  } catch (pushErr) {
    console.error("Error al enviar push de sustitución:", pushErr);
  }

  revalidatePath("/comude");
}

