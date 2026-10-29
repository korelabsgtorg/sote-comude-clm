'use server';

import { createClient } from '@/utils/supabase/server';
import { sendPushToUsers } from '@/utils/push-utils';
import { revalidatePath } from 'next/cache';
import { getGlobalMunicipioCookie } from '@/components/(base)/layout/actions';
import {
  ActividadPunto,
  ActividadPuntoMiembro,
  UsuarioAsignablePunto,
  ActividadComudeConContexto,
} from './zod';

const T_ACTIVIDADES = 'tra_actividades';
const T_MIEMBROS = 'tra_actividad_miembros';
const T_ENLACES = 'tra_actividad_comude_enlaces';
const T_ENLACES_COMISION = 'tra_actividad_comision_enlaces';

interface ChecklistItemInput {
  title: string;
  is_completed: boolean;
}

interface MiembroInput {
  userId: string;
  asignaciones?: { title: string; is_complete: boolean }[];
}

function normalizarAsignaciones(items: unknown): { title: string; is_complete: boolean }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => {
      if (typeof i === 'string') {
        return { title: i.trim(), is_complete: false };
      }
      return {
        title: String(i?.title ?? i?.titulo ?? i?.nombre ?? '').trim(),
        is_complete: Boolean(i?.is_complete ?? i?.completado),
      };
    })
    .filter((i) => i.title.length > 0);
}

function normalizarChecklist(items: unknown): { title: string; is_completed: boolean }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => {
      if (typeof i === 'string') {
        return { title: i.trim(), is_completed: false };
      }
      return {
        title: String(i?.title ?? i?.titulo ?? i?.nombre ?? '').trim(),
        is_completed: Boolean(i?.is_completed ?? i?.is_complete ?? i?.completado),
      };
    })
    .filter((i) => i.title.length > 0);
}

export interface CrearActividadPuntoInput {
  puntoId: string;
  titulo: string;
  descripcion?: string | null;
  fechaLimite: string;
  encargadoId: string;
  checklist?: ChecklistItemInput[];
  miembros?: MiembroInput[];
  comisionId?: string | null;
}

export interface EditarActividadPuntoInput {
  titulo: string;
  descripcion?: string | null;
  fechaLimite: string;
  encargadoId: string;
  checklist?: ChecklistItemInput[];
  miembros?: MiembroInput[];
}

/** Helper para obtener el municipio_id efectivo del usuario en sesión */
async function getEffectiveMunicipioId(supabase: any): Promise<number | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('municipio_id, rol')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const isSuper = profile.rol?.toLowerCase() === 'super';
  if (isSuper) {
    const globalMun = await getGlobalMunicipioCookie();
    if (globalMun?.id) {
      return globalMun.id;
    }
    return profile.municipio_id ?? null;
  }

  return profile.municipio_id ?? null;
}

/** Obtiene todos los usuarios disponibles del municipio para asignación */
export async function obtenerUsuariosAsignablesMunicipio(): Promise<UsuarioAsignablePunto[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  const isSuper = (currentProfile?.rol || user.user_metadata?.rol || '').toLowerCase().trim() === 'super';

  const municipioId = await getEffectiveMunicipioId(supabase);
  if (!municipioId) return [];

  let query = supabase
    .from('profiles')
    .select('id, nombre, email, puesto_id, activo, rol')
    .eq('municipio_id', municipioId)
    .eq('activo', true)
    .order('nombre');

  if (!isSuper) {
    query = query.neq('rol', 'super');
  }

  const { data: profiles, error } = await query;

  if (error || !profiles) {
    console.error('[actividadesPunto] Error obteniendo usuarios asignables:', error?.message);
    return [];
  }

  // Traer nombres de puesto
  const puestoIds = Array.from(new Set(profiles.map((p) => p.puesto_id).filter(Boolean)));
  let puestosMap = new Map<string, string>();

  if (puestoIds.length > 0) {
    const { data: puestos } = await supabase
      .from('puestos')
      .select('id, nombre')
      .in('id', puestoIds);
    (puestos || []).forEach((p) => puestosMap.set(p.id, p.nombre));
  }

  return profiles.map((p) => ({
    id: p.id,
    nombre: p.nombre || 'Sin nombre',
    email: p.email || '',
    puesto: p.puesto_id ? puestosMap.get(p.puesto_id) || null : null,
    rol: p.rol || null,
  }));
}

/** Obtiene las actividades vinculadas a un punto de agenda COMUDE específico */
export async function obtenerActividadesDePunto(puntoId: string): Promise<ActividadPunto[]> {
  const supabase = await createClient();

  // 1. Obtener los enlaces del punto
  const { data: enlaces, error: errorEnlaces } = await supabase
    .from(T_ENLACES)
    .select('actividad_id')
    .eq('punto_comude_id', puntoId);

  if (errorEnlaces || !enlaces || enlaces.length === 0) {
    return [];
  }

  const actividadIds = Array.from(new Set(enlaces.map((e) => e.actividad_id)));

  // 2. Cargar actividades
  const { data: actividades, error: errorActividades } = await supabase
    .from(T_ACTIVIDADES)
    .select('*')
    .in('id', actividadIds)
    .order('fecha_limite', { ascending: true });

  if (errorActividades || !actividades || actividades.length === 0) {
    return [];
  }

  // 3. Cargar miembros de esas actividades
  const { data: rawMiembros, error: errMiembros } = await supabase
    .from(T_MIEMBROS)
    .select('*')
    .in('actividad_id', actividadIds)
    .order('creado_en', { ascending: true });

  if (errMiembros) {
    console.error('[actividadesPunto] Error cargando miembros:', errMiembros);
  }

  // 4. Cargar perfiles de encargados y miembros
  const userIds = new Set<string>();
  actividades.forEach((a) => {
    if (a.encargado_id) userIds.add(String(a.encargado_id));
    if (a.creador_id) userIds.add(String(a.creador_id));
  });
  (rawMiembros || []).forEach((m) => {
    if (m.usuario_id) userIds.add(String(m.usuario_id));
  });

  const userIdsArr = Array.from(userIds);
  let perfilesMap = new Map<string, { nombre: string; puesto_id?: string | null }>();
  let puestosMap = new Map<string, string>();

  if (userIdsArr.length > 0) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, puesto_id')
      .in('id', userIdsArr);

    (perfiles || []).forEach((p) => perfilesMap.set(String(p.id), p));

    const puestoIds = Array.from(new Set((perfiles || []).map((p) => p.puesto_id).filter(Boolean)));
    if (puestoIds.length > 0) {
      const { data: puestos } = await supabase
        .from('puestos')
        .select('id, nombre')
        .in('id', puestoIds);
      (puestos || []).forEach((p) => puestosMap.set(String(p.id), p.nombre));
    }
  }

  // Mapear miembros por actividad
  const miembrosPorActividad = new Map<string, ActividadPuntoMiembro[]>();
  (rawMiembros || []).forEach((m: any) => {
    const actIdStr = String(m.actividad_id);
    const list = miembrosPorActividad.get(actIdStr) || [];
    const perfil = perfilesMap.get(String(m.usuario_id));
    const puestoNombre = perfil?.puesto_id ? puestosMap.get(String(perfil.puesto_id)) || null : null;

    list.push({
      id: String(m.id),
      actividad_id: actIdStr,
      usuario_id: String(m.usuario_id),
      asignaciones: normalizarAsignaciones(m.asignaciones),
      fecha_confirmacion: m.fecha_confirmacion ?? null,
      fecha_finalizacion: m.fecha_finalizacion ?? null,
      nombre_usuario: perfil?.nombre || 'Usuario',
      puesto: puestoNombre,
    });
    miembrosPorActividad.set(actIdStr, list);
  });

  // 4b. Enlaces a comisiones
  const { data: rawEnlacesComision } = await supabase
    .from(T_ENLACES_COMISION)
    .select('actividad_id, comision_id')
    .in('actividad_id', actividadIds);

  const comisionIds = Array.from(new Set((rawEnlacesComision || []).map((r: any) => r.comision_id).filter(Boolean)));
  const comisionesMap = new Map<string, string>();
  if (comisionIds.length > 0) {
    const { data: comisionesData } = await supabase
      .from('comisiones')
      .select('id, nombre')
      .in('id', comisionIds);
    (comisionesData || []).forEach((c: any) => comisionesMap.set(c.id, c.nombre));
  }

  const comisionPorActividad = new Map<string, { id: string; nombre: string }>();
  (rawEnlacesComision || []).forEach((r: any) => {
    if (r.actividad_id && r.comision_id) {
      comisionPorActividad.set(String(r.actividad_id), {
        id: String(r.comision_id),
        nombre: comisionesMap.get(String(r.comision_id)) || 'Comisión',
      });
    }
  });

  // 5. Estructurar resultado
  return actividades.map((a: any) => {
    const actIdStr = String(a.id);
    const encargadoPerfil = perfilesMap.get(String(a.encargado_id));
    const creadorPerfil = perfilesMap.get(String(a.creador_id));
    const encargadoPuesto = encargadoPerfil?.puesto_id ? puestosMap.get(String(encargadoPerfil.puesto_id)) || null : null;
    const comisionInfo = comisionPorActividad.get(actIdStr);

    return {
      id: actIdStr,
      titulo: a.titulo,
      descripcion: a.descripcion,
      fecha_limite: a.fecha_limite,
      estado: a.estado || 'Asignado',
      encargado_id: a.encargado_id,
      encargado_nombre: encargadoPerfil?.nombre || 'Sin asignar',
      encargado_puesto: encargadoPuesto,
      creador_id: a.creador_id,
      creador_nombre: creadorPerfil?.nombre || 'Desconocido',
      fecha_confirmacion: a.fecha_confirmacion ?? null,
      checklist: normalizarChecklist(a.checklist),
      miembros: miembrosPorActividad.get(actIdStr) || [],
      archivos: Array.isArray(a.archivos) ? a.archivos : [],
      revisado_por: a.revisado_por ?? null,
      created_at: a.created_at || a.creado_en,
      actualizado_en: a.actualizado_en ?? null,
      comision_id: comisionInfo?.id || null,
      comision_nombre: comisionInfo?.nombre || null,
    };
  });
}

/** Crea una nueva actividad derivada de un punto de agenda COMUDE */
export async function crearActividadPunto(input: CrearActividadPuntoInput): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  const municipioId = await getEffectiveMunicipioId(supabase);
  if (!municipioId) return { success: false, error: 'No se identificó el municipio.' };

  // 1. Insertar en tra_actividades
  const { data: nuevaActividad, error: errorActividad } = await supabase
    .from(T_ACTIVIDADES)
    .insert({
      municipio_id: municipioId,
      titulo: input.titulo.trim(),
      descripcion: input.descripcion?.trim() || null,
      fecha_limite: new Date(input.fechaLimite).toISOString(),
      estado: 'Asignado',
      encargado_id: input.encargadoId,
      creador_id: user.id,
      fecha_confirmacion: null,
      checklist: input.checklist || [],
      archivos: [],
      revisado_por: null,
      actualizado_en: null,
    })
    .select('id')
    .single();

  if (errorActividad || !nuevaActividad) {
    console.error('[actividadesPunto] Error creando actividad:', errorActividad);
    return { success: false, error: errorActividad?.message || 'No se pudo crear la actividad.' };
  }

  const actividadId = nuevaActividad.id;

  // 2. Insertar en tra_actividad_comude_enlaces
  const { error: errorEnlace } = await supabase
    .from(T_ENLACES)
    .insert({
      punto_comude_id: input.puntoId,
      actividad_id: actividadId,
    });

  if (errorEnlace) {
    console.error('[actividadesPunto] Error vinculando con punto COMUDE:', errorEnlace);
    // Rollback para evitar huérfanos
    await supabase.from(T_ACTIVIDADES).delete().eq('id', actividadId);
    return { success: false, error: 'No se pudo vincular la actividad con el punto de COMUDE.' };
  }

  // 3. Insertar miembros si se proporcionaron
  if (input.miembros && input.miembros.length > 0) {
    const miembrosInsert = input.miembros
      .filter((m) => m.userId && m.userId !== input.encargadoId)
      .map((m) => ({
        actividad_id: actividadId,
        usuario_id: m.userId,
        asignaciones: m.asignaciones || [],
        fecha_confirmacion: null,
        fecha_finalizacion: null,
      }));

    if (miembrosInsert.length > 0) {
      const { error: errorMiembros } = await supabase
        .from(T_MIEMBROS)
        .insert(miembrosInsert);

      if (errorMiembros) {
        console.error('[actividadesPunto] Error insertando miembros:', errorMiembros);
      }
    }
  }

  // 3b. Insertar enlace a comisión si aplica
  if (input.comisionId) {
    const { error: errorEnlaceComision } = await supabase
      .from(T_ENLACES_COMISION)
      .insert({
        actividad_id: actividadId,
        comision_id: input.comisionId,
      });

    if (errorEnlaceComision) {
      console.error('[actividadesPunto] Error vinculando con comisión:', errorEnlaceComision);
    }
  }

  // 4. Enviar notificación push
  try {
    const receptoresPush = [input.encargadoId];
    if (input.miembros && input.miembros.length > 0) {
      input.miembros.forEach((m) => {
        if (m.userId && !receptoresPush.includes(m.userId)) {
          receptoresPush.push(m.userId);
        }
      });
    }

    await sendPushToUsers(receptoresPush, {
      title: '📋 Nuevo Acuerdo COMUDE Asignado',
      body: `Se ha generado una nueva actividad derivada de COMUDE: "${input.titulo.trim()}"`,
      url: '/comude/actividades/mis-actividades',
    });
  } catch (pushErr) {
    console.error('[actividadesPunto] Error enviando push:', pushErr);
  }

  // 5. Revalidar rutas
  revalidatePath('/comude/actividades', 'layout');
  revalidatePath('/comude/actividades/mis-actividades', 'layout');
  if (input.comisionId) {
    revalidatePath('/comude/comisiones', 'layout');
    revalidatePath('/comude/comisiones/supervision', 'layout');
  }

  return { success: true, data: { id: actividadId } };
}

/** Edita una actividad derivada de un punto de agenda */
export async function editarActividadPunto(
  actividadId: string,
  input: EditarActividadPuntoInput,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  // Actualizar datos de la actividad
  const { error: errorUpdate } = await supabase
    .from(T_ACTIVIDADES)
    .update({
      titulo: input.titulo.trim(),
      descripcion: input.descripcion?.trim() || null,
      fecha_limite: new Date(input.fechaLimite).toISOString(),
      encargado_id: input.encargadoId,
      checklist: input.checklist || [],
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', actividadId);

  if (errorUpdate) {
    return { success: false, error: errorUpdate.message };
  }

  // Actualizar miembros si se suministran
  if (input.miembros !== undefined) {
    await supabase.from(T_MIEMBROS).delete().eq('actividad_id', actividadId);

    const miembrosInsert = input.miembros
      .filter((m) => m.userId && m.userId !== input.encargadoId)
      .map((m) => ({
        actividad_id: actividadId,
        usuario_id: m.userId,
        asignaciones: m.asignaciones || [],
        fecha_confirmacion: null,
        fecha_finalizacion: null,
      }));

    if (miembrosInsert.length > 0) {
      await supabase.from(T_MIEMBROS).insert(miembrosInsert);
    }
  }

  revalidatePath('/comude/actividades', 'layout');
  revalidatePath('/comude/actividades/mis-actividades', 'layout');

  return { success: true };
}

/** Elimina una actividad y su enlace con el punto COMUDE */
export async function eliminarActividadPunto(
  actividadId: string,
  puntoId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  // Eliminar el enlace
  await supabase
    .from(T_ENLACES)
    .delete()
    .eq('actividad_id', actividadId)
    .eq('punto_comude_id', puntoId);

  // Eliminar la actividad (y por cascade o eliminación directa miembros)
  await supabase.from(T_MIEMBROS).delete().eq('actividad_id', actividadId);
  const { error } = await supabase.from(T_ACTIVIDADES).delete().eq('id', actividadId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/comude/actividades', 'layout');
  revalidatePath('/comude/actividades/mis-actividades', 'layout');

  return { success: true };
}

/** Actualiza el checklist de una actividad */
export async function toggleChecklistActividadPunto(
  actividadId: string,
  checklist: ChecklistItemInput[],
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from(T_ACTIVIDADES)
    .update({ checklist, actualizado_en: new Date().toISOString() })
    .eq('id', actividadId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Actualiza las asignaciones de un miembro de la actividad */
export async function toggleMiembroChecklistActividadPunto(
  miembroId: string,
  asignaciones: { title: string; is_complete: boolean }[],
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from(T_MIEMBROS)
    .update({ asignaciones })
    .eq('id', miembroId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Marca una actividad derivada de COMUDE como revisada por COMUDE */
export async function marcarActividadRevisadaPorComude(
  actividadId: string,
  puntoId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  const { data: actividad, error: errAct } = await supabase
    .from(T_ACTIVIDADES)
    .select('id, estado')
    .eq('id', actividadId)
    .single();

  if (errAct || !actividad) {
    return { success: false, error: 'Actividad no encontrada.' };
  }

  if (actividad.estado !== 'Completado') {
    return { success: false, error: 'Solo se pueden revisar actividades completadas.' };
  }

  const { error } = await supabase
    .from(T_ACTIVIDADES)
    .update({
      revisado_por: {
        nombre: 'COMUDE',
        fecha: new Date().toISOString(),
      },
    })
    .eq('id', actividadId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/comude/actividades', 'layout');
  revalidatePath('/comude/actividades/mis-actividades', 'layout');
  revalidatePath('/comude/comude', 'layout');

  return { success: true };
}

/** Desmarca la revisión de una actividad de COMUDE */
export async function desmarcarActividadRevisadaPorComude(
  actividadId: string,
  puntoId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  const { error } = await supabase
    .from(T_ACTIVIDADES)
    .update({
      revisado_por: null,
    })
    .eq('id', actividadId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/comude/actividades', 'layout');
  revalidatePath('/comude/actividades/mis-actividades', 'layout');
  revalidatePath('/comude/comude', 'layout');

  return { success: true };
}

/** Finaliza una actividad de COMUDE marcándola como Completada */
export async function finalizarActividadPunto(
  actividadId: string,
  puntoId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  // Validar que solo el asignado pueda finalizar la actividad
  const { data: act, error: errorAct } = await supabase
    .from(T_ACTIVIDADES)
    .select('encargado_id')
    .eq('id', actividadId)
    .single();

  if (errorAct || !act) {
    return { success: false, error: 'Actividad no encontrada.' };
  }

  if (act.encargado_id !== user.id) {
    return { success: false, error: 'Solo la persona asignada a la actividad puede marcarla como completada.' };
  }

  const { error } = await supabase
    .from(T_ACTIVIDADES)
    .update({
      estado: 'Completado',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', actividadId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/comude/actividades', 'layout');
  revalidatePath('/comude/actividades/mis-actividades', 'layout');
  revalidatePath('/comude/comude', 'layout');

  return { success: true };
}

/** Obtiene todas las actividades asignadas de COMUDE para el municipio con su contexto (punto y sesión) */
export async function obtenerTodasActividadesComude(): Promise<ActividadComudeConContexto[]> {
  const supabase = await createClient();
  const municipioId = await getEffectiveMunicipioId(supabase);
  if (!municipioId) return [];

  // 1. Obtener los enlaces de actividades COMUDE
  const { data: enlaces, error: errorEnlaces } = await supabase
    .from(T_ENLACES)
    .select('actividad_id, punto_comude_id');

  if (errorEnlaces || !enlaces || enlaces.length === 0) {
    return [];
  }

  const actividadIds = Array.from(new Set(enlaces.map((e) => e.actividad_id)));
  const puntoIds = Array.from(new Set(enlaces.map((e) => e.punto_comude_id)));

  // 2. Traer actividades pertenecientes al municipio
  const { data: actividades, error: errorActividades } = await supabase
    .from(T_ACTIVIDADES)
    .select('*')
    .in('id', actividadIds)
    .eq('municipio_id', municipioId)
    .order('fecha_limite', { ascending: true });

  if (errorActividades || !actividades || actividades.length === 0) {
    return [];
  }

  const validActividadIds = new Set(actividades.map((a) => a.id));
  const validEnlaces = enlaces.filter((e) => validActividadIds.has(e.actividad_id));

  // 3. Traer los puntos
  const { data: puntos } = await supabase
    .from('act_comude_puntos')
    .select('id, titulo, act_comude_id')
    .in('id', puntoIds);

  const puntoMap = new Map((puntos || []).map((p) => [p.id, p]));

  // 4. Traer las sesiones COMUDE
  const comudeIds = Array.from(
    new Set((puntos || []).map((p) => p.act_comude_id).filter((id): id is string => !!id)),
  );

  const { data: comudes } = comudeIds.length > 0
    ? await supabase
        .from('act_comude')
        .select('id, fecha, detalles_sesion, estado')
        .in('id', comudeIds)
    : { data: [] as any[] };

  const comudeMap = new Map((comudes || []).map((c: any) => [c.id, c]));

  // 5. Traer miembros de estas actividades
  const { data: rawMiembros } = await supabase
    .from(T_MIEMBROS)
    .select('*')
    .in('actividad_id', Array.from(validActividadIds))
    .order('created_at', { ascending: true });

  // 6. Traer perfiles y puestos
  const userIds = new Set<string>();
  actividades.forEach((a) => {
    if (a.encargado_id) userIds.add(a.encargado_id);
    if (a.creador_id) userIds.add(a.creador_id);
  });
  (rawMiembros || []).forEach((m) => {
    if (m.usuario_id) userIds.add(m.usuario_id);
  });

  const userIdsArr = Array.from(userIds);
  let perfilesMap = new Map<string, { nombre: string; puesto_id?: string | null }>();
  let puestosMap = new Map<string, string>();

  if (userIdsArr.length > 0) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, puesto_id')
      .in('id', userIdsArr);

    (perfiles || []).forEach((p) => perfilesMap.set(p.id, p));

    const puestoIds = Array.from(new Set((perfiles || []).map((p) => p.puesto_id).filter(Boolean)));
    if (puestoIds.length > 0) {
      const { data: puestos } = await supabase
        .from('puestos')
        .select('id, nombre')
        .in('id', puestoIds);
      (puestos || []).forEach((p) => puestosMap.set(p.id, p.nombre));
    }
  }

  // Mapear miembros por actividad
  const miembrosPorActividad = new Map<string, ActividadPuntoMiembro[]>();
  (rawMiembros || []).forEach((m: any) => {
    const list = miembrosPorActividad.get(m.actividad_id) || [];
    const perfil = perfilesMap.get(m.usuario_id);
    const puestoNombre = perfil?.puesto_id ? puestosMap.get(perfil.puesto_id) || null : null;

    list.push({
      id: m.id,
      actividad_id: m.actividad_id,
      usuario_id: m.usuario_id,
      asignaciones: normalizarAsignaciones(m.asignaciones),
      fecha_confirmacion: m.fecha_confirmacion ?? null,
      fecha_finalizacion: m.fecha_finalizacion ?? null,
      nombre_usuario: perfil?.nombre || 'Usuario',
      puesto: puestoNombre,
    });
    miembrosPorActividad.set(m.actividad_id, list);
  });

  // Mapear enlace por actividad
  const enlacePorActividad = new Map(validEnlaces.map((e) => [e.actividad_id, e.punto_comude_id]));

  // 7. Retornar actividades con contexto completo
  const resultado: ActividadComudeConContexto[] = [];

  for (const a of actividades) {
    const puntoId = enlacePorActividad.get(a.id);
    if (!puntoId) continue;
    const punto = puntoMap.get(puntoId);
    if (!punto) continue;
    const comude = punto.act_comude_id ? comudeMap.get(punto.act_comude_id) : null;

    const encargadoPerfil = perfilesMap.get(a.encargado_id);
    const creadorPerfil = perfilesMap.get(a.creador_id);
    const encargadoPuesto = encargadoPerfil?.puesto_id ? puestosMap.get(encargadoPerfil.puesto_id) || null : null;

    resultado.push({
      id: a.id,
      titulo: a.titulo,
      descripcion: a.descripcion,
      fecha_limite: a.fecha_limite,
      estado: a.estado || 'Asignado',
      encargado_id: a.encargado_id,
      encargado_nombre: encargadoPerfil?.nombre || 'Sin asignar',
      encargado_puesto: encargadoPuesto,
      creador_id: a.creador_id,
      creador_nombre: creadorPerfil?.nombre || 'Desconocido',
      fecha_confirmacion: a.fecha_confirmacion ?? null,
      checklist: normalizarChecklist(a.checklist),
      miembros: miembrosPorActividad.get(a.id) || [],
      archivos: Array.isArray(a.archivos) ? a.archivos : [],
      revisado_por: a.revisado_por ?? null,
      created_at: a.created_at,
      actualizado_en: a.actualizado_en ?? null,
      // Contexto
      punto_id: punto.id,
      punto_titulo: punto.titulo || 'Punto sin título',
      comude_id: comude?.id || '',
      comude_titulo: comude?.detalles_sesion?.titulo || 'Sesión COMUDE',
      comude_fecha: comude?.fecha || '',
      comude_estado: comude?.estado || 'En progreso',
      comude_descripcion: comude?.detalles_sesion?.descripcion || null,
    });
  }

  return resultado;
}

