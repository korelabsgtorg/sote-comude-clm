'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendPushToUsers } from '@/utils/push-utils';
import { getGlobalMunicipioCookie } from '@/components/(base)/layout/actions';
import {
  ESTADOS_TAREA,
  normalizarEstado,
  REMITENTE_COMUDE,
  RUTAS_TAREAS,
  BUCKET_ARCHIVOS_TAREAS,
  type EstadoTarea,
  type ChecklistItem,
  type NewTaskState,
  type Tarea,
  type Usuario,
  type PerfilUsuario,
  type TipoVistaTareas,
  type AsignacionMiembro,
  type ActMiembro,
  type ArchivoAdjunto,
  type ActualizarTareaInput,
  type ActividadPendiente,
  type OficinaInfo,
} from './zod';

// ═════════════════════════════════════════════════════════════════════════════
// Tablas
// ═════════════════════════════════════════════════════════════════════════════

const T_ACTIVIDADES = 'tra_actividades';
const T_MIEMBROS = 'tra_actividad_miembros';
const T_ENLACES = 'tra_actividad_comude_enlaces';
const T_ENLACES_COMISION = 'tra_actividad_comision_enlaces';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Resultado estándar de mutaciones (los mensajes de error de un `throw` se ocultan en producción) */
export type ActionResult<T = undefined> =
  | { success: true; data?: T; error?: undefined }
  | { success: false; error: string; data?: undefined };

const ok = <T,>(data?: T): ActionResult<T> => ({ success: true, data });
const fail = (error: string): ActionResult<never> => ({ success: false, error });

const CHUNK = 100;

const revalidarModulo = () => {
  revalidatePath(RUTAS_TAREAS.mis_actividades);
  revalidatePath('/comude/comisiones');
};

// ═════════════════════════════════════════════════════════════════════════════
// Contexto de usuario / municipio
// ═════════════════════════════════════════════════════════════════════════════

interface Contexto {
  supabase: SupabaseServerClient;
  userId: string;
  nombre: string;
  rol: string | null;
  puestoId: string | null;
  municipioId: number | null;
  esSupervisor: boolean;
}

function esRolSupervisor(rol: string | null | undefined) {
  const r = (rol || '').toLowerCase().trim();
  return r === 'super' || r === 'admin' || r === 'administrador';
}

async function obtenerContexto(): Promise<Contexto | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nombre, rol, puesto_id, municipio_id')
    .eq('id', user.id)
    .maybeSingle();

  const rol = (profile?.rol as string | null) ?? (user.user_metadata?.rol as string | null) ?? null;
  let municipioId: number | null = (profile?.municipio_id as number | null) ?? null;

  // El rol "super" trabaja sobre el municipio seleccionado globalmente
  if ((rol || '').toLowerCase() === 'super') {
    const cookie = await getGlobalMunicipioCookie();
    if (cookie?.id) municipioId = cookie.id;
  }

  return {
    supabase,
    userId: user.id,
    nombre: (profile?.nombre as string) || (user.user_metadata?.nombre as string) || 'Usuario',
    rol,
    puestoId: (profile?.puesto_id as string | null) ?? null,
    municipioId,
    esSupervisor: esRolSupervisor(rol),
  };
}

async function selectEnChunks<T = any>(
  build: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  ids: string[],
): Promise<T[]> {
  const resultado: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await build(ids.slice(i, i + CHUNK));
    if (error) console.error('[tareas] Error en consulta por bloques:', error);
    if (data) resultado.push(...data);
  }
  return resultado;
}

// ─── Estructura organizacional (departamentos / puestos / jefaturas) ─────────

interface EstructuraMunicipio {
  departamentos: Map<string, { id: string; nombre: string; parent_id: string | null }>;
  puestos: Map<string, { id: string; nombre: string; departamento_id: string | null }>;
  jefaturasPorPuesto: Map<string, string[]>; // puesto_id -> departamento_ids que dirige
  hijosPorDepartamento: Map<string, string[]>;
}

async function cargarEstructura(ctx: Contexto): Promise<EstructuraMunicipio> {
  const vacia: EstructuraMunicipio = {
    departamentos: new Map(),
    puestos: new Map(),
    jefaturasPorPuesto: new Map(),
    hijosPorDepartamento: new Map(),
  };
  if (!ctx.municipioId) return vacia;

  const [depsRes, puestosRes] = await Promise.all([
    ctx.supabase.from('departamentos').select('id, nombre, parent_id').eq('municipio_id', ctx.municipioId),
    ctx.supabase.from('puestos').select('id, nombre, departamento_id').eq('municipio_id', ctx.municipioId),
  ]);

  for (const d of depsRes.data || []) {
    vacia.departamentos.set(String(d.id), {
      id: String(d.id),
      nombre: String(d.nombre ?? ''),
      parent_id: (d.parent_id as string | null) ?? null,
    });
    if (d.parent_id) {
      const lista = vacia.hijosPorDepartamento.get(String(d.parent_id)) || [];
      lista.push(String(d.id));
      vacia.hijosPorDepartamento.set(String(d.parent_id), lista);
    }
  }

  for (const p of puestosRes.data || []) {
    vacia.puestos.set(String(p.id), {
      id: String(p.id),
      nombre: String(p.nombre ?? ''),
      departamento_id: (p.departamento_id as string | null) ?? null,
    });
  }

  const puestoIds = Array.from(vacia.puestos.keys());
  if (puestoIds.length > 0) {
    const jefaturas = await selectEnChunks<{ puesto_id: string; departamento_id: string }>(
      (chunk) => ctx.supabase.from('puesto_jefaturas').select('puesto_id, departamento_id').in('puesto_id', chunk),
      puestoIds,
    );
    for (const j of jefaturas) {
      if (!vacia.departamentos.has(String(j.departamento_id))) continue;
      const lista = vacia.jefaturasPorPuesto.get(String(j.puesto_id)) || [];
      lista.push(String(j.departamento_id));
      vacia.jefaturasPorPuesto.set(String(j.puesto_id), lista);
    }
  }

  return vacia;
}

/** Departamentos a cargo + todos sus sub-departamentos (recursivo por parent_id) */
function departamentosBajoMando(estructura: EstructuraMunicipio, puestoId: string | null): Set<string> {
  const resultado = new Set<string>();
  if (!puestoId) return resultado;
  const pila = [...(estructura.jefaturasPorPuesto.get(puestoId) || [])];
  while (pila.length > 0) {
    const actual = pila.pop() as string;
    if (resultado.has(actual)) continue;
    resultado.add(actual);
    pila.push(...(estructura.hijosPorDepartamento.get(actual) || []));
  }
  return resultado;
}

function construirPerfil(ctx: Contexto, estructura: EstructuraMunicipio): PerfilUsuario {
  const oficinas: OficinaInfo[] = (ctx.puestoId ? estructura.jefaturasPorPuesto.get(ctx.puestoId) || [] : [])
    .map((id) => estructura.departamentos.get(id))
    .filter((d): d is { id: string; nombre: string; parent_id: string | null } => !!d)
    .map((d) => ({ id: d.id, nombre: d.nombre }));

  const esSuper = (ctx.rol || '').toLowerCase().trim() === 'super';

  return {
    id: ctx.userId,
    nombre: ctx.nombre,
    rol: ctx.rol,
    esJefe: oficinas.length > 0 || esSuper,
    esSupervisor: ctx.esSupervisor,
    municipioId: ctx.municipioId,
    oficinasACargo: oficinas,
  };
}

export async function verificarEsJefeUsuario(): Promise<boolean> {
  const ctx = await obtenerContexto();
  if (!ctx || !ctx.puestoId) return false;

  const { count, error } = await ctx.supabase
    .from('puesto_jefaturas')
    .select('departamento_id', { count: 'exact', head: true })
    .eq('puesto_id', ctx.puestoId);

  if (error || !count) return false;
  return count > 0;
}

interface ProfileRow {
  id: string;
  nombre: string | null;
  activo: boolean | null;
  puesto_id: string | null;
  rol?: string | null;
}

function mapUsuario(p: ProfileRow, estructura: EstructuraMunicipio): Usuario {
  const puesto = p.puesto_id ? estructura.puestos.get(p.puesto_id) : undefined;
  const departamento = puesto?.departamento_id ? estructura.departamentos.get(puesto.departamento_id) : undefined;
  return {
    user_id: String(p.id),
    nombre: p.nombre || 'Sin nombre',
    activo: p.activo !== false,
    esjefe: !!(p.puesto_id && (estructura.jefaturasPorPuesto.get(p.puesto_id) || []).length > 0),
    oficina_nombre: departamento?.nombre || 'Sin Dependencia Asignada',
    dependencia_id: departamento?.id || null,
    puesto_nombre: puesto?.nombre || null,
    rol: p.rol || null,
  };
}

/** IDs de los usuarios subordinados al jefe (por departamentos a cargo y sus sub-departamentos) */
async function obtenerSubordinados(ctx: Contexto, estructura?: EstructuraMunicipio): Promise<Set<string>> {
  const est = estructura || (await cargarEstructura(ctx));
  const deps = departamentosBajoMando(est, ctx.puestoId);
  const ids = new Set<string>();
  if (deps.size === 0 || !ctx.municipioId) return ids;

  const puestosEnAlcance = Array.from(est.puestos.values())
    .filter((p) => p.departamento_id && deps.has(p.departamento_id))
    .map((p) => p.id);
  if (puestosEnAlcance.length === 0) return ids;

  const perfiles = await selectEnChunks<{ id: string }>(
    (chunk) =>
      ctx.supabase.from('profiles').select('id').eq('municipio_id', ctx.municipioId as number).in('puesto_id', chunk),
    puestosEnAlcance,
  );
  perfiles.forEach((p) => {
    if (p.id !== ctx.userId) ids.add(String(p.id));
  });
  return ids;
}

/** Verifica que los usuarios pertenezcan al municipio activo (aislamiento entre municipios) */
async function usuariosDelMunicipio(ctx: Contexto, userIds: string[]): Promise<Set<string>> {
  const unicos = Array.from(new Set(userIds.filter(Boolean)));
  if (unicos.length === 0 || !ctx.municipioId) return new Set();
  const rows = await selectEnChunks<{ id: string }>(
    (chunk) => ctx.supabase.from('profiles').select('id').eq('municipio_id', ctx.municipioId as number).in('id', chunk),
    unicos,
  );
  return new Set(rows.map((r) => String(r.id)));
}

// ═════════════════════════════════════════════════════════════════════════════
// Mapeo BD (tra_*) -> forma UI
// ═════════════════════════════════════════════════════════════════════════════

function normalizarChecklist(items: unknown): ChecklistItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => ({
      title: String(i?.title ?? i?.titulo ?? '').trim(),
      is_completed: Boolean(i?.is_completed ?? i?.completado),
    }))
    .filter((i) => i.title.length > 0);
}

function normalizarAsignaciones(items: unknown): AsignacionMiembro[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => ({
      title: String(i?.title ?? i?.titulo ?? '').trim(),
      is_complete: Boolean(i?.is_complete ?? i?.completado),
    }))
    .filter((i) => i.title.length > 0);
}

/** JSONB checklist -> estructura de BD: [{ titulo, completado }] */
const checklistADb = (items: ChecklistItem[]) => items.map((i) => ({ titulo: i.title, completado: i.is_completed }));
const asignacionesADb = (items: AsignacionMiembro[]) =>
  items.map((i) => ({ titulo: i.title, completado: i.is_complete }));

function mapTarea(row: any): Tarea {
  const estadoMapeado = normalizarEstado(row.estado) || row.estado || ESTADOS_TAREA.ASIGNADO;
  return {
    id: String(row.id),
    title: row.titulo,
    description: row.descripcion ?? null,
    due_date: row.fecha_limite,
    status: estadoMapeado,
    checklist: normalizarChecklist(row.checklist),
    assigned_to: row.encargado_id ?? null,
    created_by: row.creador_id,
    created_at: row.creado_en,
    updated_at: row.actualizado_en ?? null,
    confirmed_at: row.fecha_confirmacion ?? null,
    archivos: Array.isArray(row.archivos) ? (row.archivos as ArchivoAdjunto[]) : [],
    revisado_por: row.revisado_por ?? null,
    municipio_id: row.municipio_id,
  };
}

function mapMiembro(row: any, nombre?: string): ActMiembro {
  return {
    id: String(row.id),
    id_act: String(row.actividad_id),
    id_user: String(row.usuario_id),
    asignaciones: normalizarAsignaciones(row.asignaciones),
    completed_at: row.fecha_finalizacion ?? null,
    confirmed_at: row.fecha_confirmacion ?? null,
    comentario: row.comentarios ?? null,
    created_at: row.creado_en,
    nombre_usuario: nombre || 'Usuario',
  };
}

/** Estado al que vuelve una actividad completada cuando se invalida */
const estadoReabierto = (row: { fecha_confirmacion?: string | null }): EstadoTarea =>
  row.fecha_confirmacion ? ESTADOS_TAREA.EN_PROCESO : ESTADOS_TAREA.ASIGNADO;

// ═════════════════════════════════════════════════════════════════════════════
// Autorización
// ═════════════════════════════════════════════════════════════════════════════

interface TareaAutorizada {
  row: any;
  esEncargado: boolean;
  esCreador: boolean;
  esMiembro: boolean;
  esJefeDelEncargado: boolean;
  esTareaComision: boolean;
  esMiembroComision: boolean;
}

async function cargarTareaAutorizada(ctx: Contexto, taskId: string): Promise<TareaAutorizada | null> {
  if (!ctx.municipioId) return null;

  const { data: row } = await ctx.supabase
    .from(T_ACTIVIDADES)
    .select('*')
    .eq('id', taskId)
    .eq('municipio_id', ctx.municipioId)
    .maybeSingle();
  if (!row) return null;

  const esEncargado = row.encargado_id === ctx.userId;
  const esCreador = row.creador_id === ctx.userId;

  const { data: miembro } = await ctx.supabase
    .from(T_MIEMBROS)
    .select('id')
    .eq('actividad_id', taskId)
    .eq('usuario_id', ctx.userId)
    .maybeSingle();
  const esMiembro = !!miembro;

  // Verificar si la actividad pertenece a una comisión
  let esTareaComision = false;
  let esMiembroComision = false;
  const { data: enlaceComision } = await ctx.supabase
    .from(T_ENLACES_COMISION)
    .select('comision_id')
    .eq('actividad_id', taskId)
    .maybeSingle();

  if (enlaceComision?.comision_id) {
    esTareaComision = true;
    const esSuper = (ctx.rol || '').toLowerCase().trim() === 'super';
    if (esSuper) {
      esMiembroComision = true;
    } else {
      const { data: integrante } = await ctx.supabase
        .from('comision_integrantes')
        .select('id')
        .eq('id_comision', enlaceComision.comision_id)
        .eq('id_integrante', ctx.userId)
        .maybeSingle();
      esMiembroComision = !!integrante;
    }
  }

  let esJefeDelEncargado = false;
  if (!esEncargado && !esCreador && !ctx.esSupervisor && !esMiembroComision && row.encargado_id) {
    const subordinados = await obtenerSubordinados(ctx);
    esJefeDelEncargado = subordinados.has(row.encargado_id);
  }

  const puedeVer =
    esEncargado ||
    esCreador ||
    esMiembro ||
    esJefeDelEncargado ||
    ctx.esSupervisor ||
    esMiembroComision;
  if (!puedeVer) return null;

  return {
    row,
    esEncargado,
    esCreador,
    esMiembro,
    esJefeDelEncargado,
    esTareaComision,
    esMiembroComision,
  };
}

/** Puede gestionar la actividad completa (editar, cerrar, administrar miembros) */
const puedeGestionar = (ctx: Contexto, t: TareaAutorizada) => {
  if (t.esTareaComision) {
    return t.esEncargado || t.esCreador || t.esMiembroComision;
  }
  return t.esEncargado || t.esCreador || t.esJefeDelEncargado || ctx.esSupervisor;
};

// ═════════════════════════════════════════════════════════════════════════════
// Query principal
// ═════════════════════════════════════════════════════════════════════════════

export async function obtenerDatosGestor(tipoVista: TipoVistaTareas): Promise<{
  perfil: PerfilUsuario;
  tareas: Tarea[];
  usuarios: Usuario[];
} | null> {
  const ctx = await obtenerContexto();
  if (!ctx) return null;

  const estructura = await cargarEstructura(ctx);
  const perfil = construirPerfil(ctx, estructura);

  if (!ctx.municipioId) return { perfil, tareas: [], usuarios: [] };
  const municipioId = ctx.municipioId;
  const supabase = ctx.supabase;

  // 1. USUARIOS DEL MUNICIPIO
  const esSuper = (ctx.rol || '').toLowerCase().trim() === 'super';
  let queryUsuarios = supabase
    .from('profiles')
    .select('id, nombre, activo, puesto_id, rol')
    .eq('municipio_id', municipioId)
    .order('nombre');

  if (!esSuper) {
    queryUsuarios = queryUsuarios.neq('rol', 'super');
  }

  const { data: rawUsuarios, error: errorUsuarios } = await queryUsuarios;

  if (errorUsuarios) {
    console.error('[tareas] Error cargando usuarios:', errorUsuarios);
    return { perfil, tareas: [], usuarios: [] };
  }

  const todosLosUsuarios: Usuario[] = (rawUsuarios || []).map((u) => mapUsuario(u as ProfileRow, estructura));
  const usuarioPorId = new Map(todosLosUsuarios.map((u) => [u.user_id, u]));

  // 2. QUERY DE TAREAS (siempre acotada al municipio)
  let rawTareas: any[] = [];
  const alcancePorTarea = new Map<string, 'equipo' | 'externa'>();
  const base = () => supabase.from(T_ACTIVIDADES).select('*').eq('municipio_id', municipioId);

  if (tipoVista === 'mis_actividades') {
    const [{ data: propias, error: errorPropias }, { data: comoMiembro }] = await Promise.all([
      base()
        .eq('encargado_id', ctx.userId)
        .order('fecha_limite', { ascending: true }),
      supabase.from(T_MIEMBROS).select('actividad_id').eq('usuario_id', ctx.userId),
    ]);

    if (errorPropias) {
      console.error('[tareas] Error obteniendo actividades:', errorPropias);
      return { perfil, tareas: [], usuarios: todosLosUsuarios };
    }

    const idsPropias = new Set((propias || []).map((t) => String(t.id)));
    const idsComoMiembro = Array.from(
      new Set((comoMiembro || []).map((m) => String(m.actividad_id)).filter((id) => !idsPropias.has(id))),
    );

    const grupales = idsComoMiembro.length
      ? await selectEnChunks((chunk) => base().in('id', chunk), idsComoMiembro)
      : [];

    rawTareas = [...(propias || []), ...grupales];
  } else if (tipoVista === 'gestion_jefe') {
    if (!perfil.esJefe) return null;

    const subordinados = await obtenerSubordinados(ctx, estructura);
    const misEmpleadosIds = Array.from(subordinados);

    if (misEmpleadosIds.length > 0) {
      const tareasEquipo = await selectEnChunks((chunk) => base().in('encargado_id', chunk), misEmpleadosIds);
      tareasEquipo.forEach((t) => alcancePorTarea.set(String(t.id), 'equipo'));
      rawTareas.push(...tareasEquipo);
    }

    const { data: creadasPorMi, error: errorCreadas } = await base().eq('creador_id', ctx.userId);
    if (errorCreadas) console.error('[tareas] Error obteniendo actividades creadas:', errorCreadas);

    const idsActuales = new Set(rawTareas.map((t) => String(t.id)));
    (creadasPorMi || [])
      .filter((t) => !idsActuales.has(String(t.id)))
      .forEach((t) => {
        const esEquipo = t.encargado_id === ctx.userId || subordinados.has(t.encargado_id);
        alcancePorTarea.set(String(t.id), esEquipo ? 'equipo' : 'externa');
        rawTareas.push(t);
      });
  } else if (tipoVista === 'gestion_rrhh') {
    if (!perfil.esSupervisor) return null;

    const { data, error } = await base().order('fecha_limite', { ascending: false });
    if (error) {
      console.error('[tareas] Error obteniendo actividades (supervisión):', error);
      return { perfil, tareas: [], usuarios: todosLosUsuarios };
    }
    rawTareas = data || [];
  }

  // Deduplicar
  const porId = new Map<string, any>();
  rawTareas.forEach((t) => porId.set(String(t.id), t));
  rawTareas = Array.from(porId.values());

  const taskIds = rawTareas.map((t) => String(t.id));

  // 3. MIEMBROS GRUPALES (batch)
  const miembrosPorTarea = new Map<string, ActMiembro[]>();
  if (taskIds.length > 0) {
    const rawMiembros = await selectEnChunks(
      (chunk) => supabase.from(T_MIEMBROS).select('*').in('actividad_id', chunk).order('creado_en', { ascending: true }),
      taskIds,
    );

    // Resolver nombres que no estén en el municipio (casos de datos heredados)
    const faltantes = Array.from(
      new Set(rawMiembros.map((m: any) => String(m.usuario_id)).filter((id) => !usuarioPorId.has(id))),
    );
    const nombresExtra = new Map<string, string>();
    if (faltantes.length) {
      const extra = await selectEnChunks<{ id: string; nombre: string }>(
        (chunk) => supabase.from('profiles').select('id, nombre').in('id', chunk),
        faltantes,
      );
      extra.forEach((p) => nombresExtra.set(String(p.id), p.nombre));
    }

    rawMiembros.forEach((m: any) => {
      const nombre = usuarioPorId.get(String(m.usuario_id))?.nombre || nombresExtra.get(String(m.usuario_id));
      const lista = miembrosPorTarea.get(String(m.actividad_id)) || [];
      lista.push(mapMiembro(m, nombre));
      miembrosPorTarea.set(String(m.actividad_id), lista);
    });
  }

  // 4. CONTEXTO COMUDE (punto de agenda + sesión)
  const contextoComude = await obtenerContextoComude(supabase, taskIds);

  // 4.5 CONTEXTO COMISIÓN (enlaces de comisiones)
  const enlacesComision = taskIds.length > 0
    ? await selectEnChunks<{ actividad_id: string; comision_id: string }>(
        (chunk) => supabase.from(T_ENLACES_COMISION).select('actividad_id, comision_id').in('actividad_id', chunk),
        taskIds,
      )
    : [];

  const comisionIds = Array.from(new Set(enlacesComision.map((e) => String(e.comision_id)).filter(Boolean)));
  const comisiones = comisionIds.length > 0
    ? await selectEnChunks<{ id: string; nombre: string }>(
        (chunk) => supabase.from('comisiones').select('id, nombre').in('id', chunk),
        comisionIds,
      )
    : [];
  const comisionMap = new Map(comisiones.map((c) => [String(c.id), String(c.nombre)]));
  const comisionPorTarea = new Map(
    enlacesComision.map((e) => [
      String(e.actividad_id),
      { id: String(e.comision_id), nombre: comisionMap.get(String(e.comision_id)) || 'Comisión' },
    ]),
  );

  // 5. MAPEAR TAREAS
  const tareas: Tarea[] = rawTareas.map((row) => {
    const t = mapTarea(row);
    const creador = usuarioPorId.get(t.created_by);
    const asignado = t.assigned_to ? usuarioPorId.get(t.assigned_to) : undefined;
    const contexto = contextoComude.get(t.id);
    const comisionInfo = comisionPorTarea.get(t.id);

    return {
      ...t,
      es_concejo: !!contexto,
      punto_id: contexto?.punto_id,
      punto_titulo: contexto?.punto_titulo,
      agenda_id: contexto?.agenda_id,
      agenda_titulo: contexto?.agenda_titulo,
      agenda_fecha: contexto?.agenda_fecha,
      comision_id: comisionInfo?.id,
      comision_nombre: comisionInfo?.nombre,
      alcance: alcancePorTarea.get(t.id),
      creator: { nombre: contexto ? REMITENTE_COMUDE : creador?.nombre || 'Desconocido' },
      assignee: {
        nombre: asignado?.nombre || 'Sin asignar',
        oficina_nombre: asignado?.oficina_nombre || comisionInfo?.nombre || 'Sin Dependencia Asignada',
      },
      miembros: miembrosPorTarea.get(t.id) || [],
    };
  });

  tareas.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  return { perfil, tareas, usuarios: todosLosUsuarios };
}

async function obtenerContextoComude(supabase: SupabaseServerClient, taskIds: string[]) {
  const contexto = new Map<
    string,
    { punto_id: string; punto_titulo: string; agenda_id: string; agenda_titulo: string; agenda_fecha: string }
  >();
  if (taskIds.length === 0) return contexto;

  const enlaces = await selectEnChunks<{ actividad_id: string; punto_comude_id: string }>(
    (chunk) => supabase.from(T_ENLACES).select('actividad_id, punto_comude_id').in('actividad_id', chunk),
    taskIds,
  );
  if (enlaces.length === 0) return contexto;

  const puntoIds = Array.from(new Set(enlaces.map((e) => String(e.punto_comude_id))));
  const puntos = await selectEnChunks<{ id: string; titulo: string; act_comude_id: string }>(
    (chunk) => supabase.from('act_comude_puntos').select('id, titulo, act_comude_id').in('id', chunk),
    puntoIds,
  );
  const puntoMap = new Map(puntos.map((p) => [String(p.id), p]));

  const sesionIds = Array.from(new Set(puntos.map((p) => String(p.act_comude_id)).filter(Boolean)));
  const sesiones = sesionIds.length
    ? await selectEnChunks<{ id: string; fecha: string; detalles_sesion: { titulo?: string } | null }>(
        (chunk) => supabase.from('act_comude').select('id, fecha, detalles_sesion').in('id', chunk),
        sesionIds,
      )
    : [];
  const sesionMap = new Map(sesiones.map((s) => [String(s.id), s]));

  enlaces.forEach((e) => {
    const punto = puntoMap.get(String(e.punto_comude_id));
    const sesion = punto ? sesionMap.get(String(punto.act_comude_id)) : undefined;
    contexto.set(String(e.actividad_id), {
      punto_id: String(e.punto_comude_id),
      punto_titulo: punto?.titulo || 'Punto desconocido',
      agenda_id: punto ? String(punto.act_comude_id) : '',
      agenda_titulo: sesion?.detalles_sesion?.titulo || 'Sesión COMUDE',
      agenda_fecha: sesion?.fecha || '',
    });
  });

  return contexto;
}

// ═════════════════════════════════════════════════════════════════════════════
// Mutaciones de tareas
// ═════════════════════════════════════════════════════════════════════════════

async function insertarTarea(
  ctx: Contexto,
  datos: NewTaskState,
  opciones: { resetChecklist?: boolean } = {},
): Promise<ActionResult<{ id: string }>> {
  if (!ctx.municipioId) return fail('Tu usuario no tiene un municipio asignado.');

  const titulo = (datos.title || '').trim();
  if (!titulo) return fail('El título es obligatorio.');

  const fecha = new Date(datos.due_date);
  if (!datos.due_date || Number.isNaN(fecha.getTime())) return fail('La fecha límite no es válida.');

  // Solo jefaturas / supervisores (o integrantes en actividades de comisión) pueden asignar a otra persona
  const estructura = await cargarEstructura(ctx);
  const perfil = construirPerfil(ctx, estructura);
  const esSuperUser = (ctx.rol || '').toLowerCase().trim() === 'super';

  if (datos.comision_id) {
    const { data: comision } = await ctx.supabase
      .from('comisiones')
      .select('id, municipio_id')
      .eq('id', datos.comision_id)
      .maybeSingle();
    if (!comision || Number(comision.municipio_id) !== Number(ctx.municipioId)) {
      return fail('La comisión no existe o pertenece a otro municipio.');
    }
    if (!esSuperUser) {
      const { data: integrante } = await ctx.supabase
        .from('comision_integrantes')
        .select('id')
        .eq('id_comision', datos.comision_id)
        .eq('id_integrante', ctx.userId)
        .maybeSingle();
      if (!integrante) {
        return fail('Solo los integrantes de la comisión o un Super Administrador pueden crear actividades en esta comisión.');
      }
    }
  }

  let encargadoId = datos.assigned_to || ctx.userId;
  if (!perfil.esJefe && !datos.comision_id && encargadoId !== ctx.userId) encargadoId = ctx.userId;

  // Miembros: sin duplicados y sin incluir al encargado
  const miembrosEntrada = (datos.miembros || []).filter(
    (m, idx, arr) => m.userId && m.userId !== encargadoId && arr.findIndex((x) => x.userId === m.userId) === idx,
  );

  // Aislamiento: encargado y miembros deben pertenecer al municipio activo (o ser integrantes de la comisión)
  const validos = await usuariosDelMunicipio(ctx, [encargadoId, ...miembrosEntrada.map((m) => m.userId)]);
  if (datos.comision_id) {
    validos.add(ctx.userId);
    const { data: intRows } = await ctx.supabase
      .from('comision_integrantes')
      .select('id_integrante')
      .eq('id_comision', datos.comision_id);
    (intRows || []).forEach((r: any) => {
      if (r.id_integrante) validos.add(String(r.id_integrante));
    });
  }
  if (!validos.has(encargadoId)) return fail('El encargado seleccionado no pertenece al municipio.');
  const miembrosInvalidos = miembrosEntrada.filter((m) => !validos.has(m.userId));
  if (miembrosInvalidos.length) return fail('Uno o más participantes no pertenecen al municipio.');

  // Si quien crea no es super, no puede asignar ni incluir a un super
  if (!esSuperUser) {
    const idsVerificar = [encargadoId, ...miembrosEntrada.map((m) => m.userId)].filter((id) => id !== ctx.userId);
    if (idsVerificar.length > 0) {
      const { data: supers } = await ctx.supabase
        .from('profiles')
        .select('id')
        .in('id', idsVerificar)
        .eq('rol', 'super');
      if (supers && supers.length > 0) {
        return fail('Solo un Super Administrador puede asignar actividades a otro Super Administrador.');
      }
    }
  }

  // Punto COMUDE (opcional) — debe pertenecer a una sesión del mismo municipio
  if (datos.punto_comude_id) {
    const { data: punto } = await ctx.supabase
      .from('act_comude_puntos')
      .select('id, act_comude_id')
      .eq('id', datos.punto_comude_id)
      .maybeSingle();
    if (!punto) return fail('El punto de agenda COMUDE no existe.');
    const { data: sesion } = await ctx.supabase
      .from('act_comude')
      .select('municipio_id')
      .eq('id', punto.act_comude_id)
      .maybeSingle();
    if (!sesion || Number(sesion.municipio_id) !== Number(ctx.municipioId)) {
      return fail('El punto de agenda COMUDE pertenece a otro municipio.');
    }
  }

  const checklist = normalizarChecklist(datos.checklist).map((i) =>
    opciones.resetChecklist ? { ...i, is_completed: false } : i,
  );

  const { data: nueva, error } = await ctx.supabase
    .from(T_ACTIVIDADES)
    .insert({
      municipio_id: ctx.municipioId,
      titulo,
      descripcion: datos.description?.trim() || null,
      fecha_limite: fecha.toISOString(),
      estado: ESTADOS_TAREA.ASIGNADO,
      encargado_id: encargadoId,
      creador_id: ctx.userId,
      fecha_confirmacion: null,
      checklist: checklistADb(checklist),
      archivos: [],
      revisado_por: null,
      actualizado_en: null,
    })
    .select('id')
    .single();

  if (error || !nueva) {
    console.error('[tareas] Error creando actividad:', error);
    return fail(error?.message || 'No se pudo crear la actividad.');
  }

  const rollback = async () => {
    await ctx.supabase.from(T_ACTIVIDADES).delete().eq('id', nueva.id);
  };

  if (miembrosEntrada.length > 0) {
    const { error: errorMiembros } = await ctx.supabase.from(T_MIEMBROS).insert(
      miembrosEntrada.map((m) => ({
        actividad_id: nueva.id,
        usuario_id: m.userId,
        asignaciones: asignacionesADb(
          normalizarAsignaciones(m.asignaciones).map((a) =>
            opciones.resetChecklist ? { ...a, is_complete: false } : a,
          ),
        ),
      })),
    );
    if (errorMiembros) {
      console.error('[tareas] Error insertando miembros:', errorMiembros);
      await rollback();
      return fail('No se pudieron registrar los participantes. La actividad no fue creada.');
    }
  }

  if (datos.punto_comude_id) {
    const { error: errorEnlace } = await ctx.supabase
      .from(T_ENLACES)
      .insert({ punto_comude_id: datos.punto_comude_id, actividad_id: nueva.id });
    if (errorEnlace) {
      console.error('[tareas] Error vinculando con COMUDE:', errorEnlace);
      await rollback();
      return fail('No se pudo vincular la actividad con el punto de COMUDE.');
    }
  }

  if (datos.comision_id) {
    const { error: errorEnlaceComision } = await ctx.supabase
      .from(T_ENLACES_COMISION)
      .insert({ comision_id: datos.comision_id, actividad_id: nueva.id });
    if (errorEnlaceComision) {
      console.error('[tareas] Error vinculando con comisión:', errorEnlaceComision);
      await rollback();
      return fail('No se pudo vincular la actividad con la comisión.');
    }
  }

  return ok({ id: String(nueva.id) });
}

export async function crearTarea(formData: NewTaskState): Promise<ActionResult<{ id: string }>> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const res = await insertarTarea(ctx, formData);
  if (res.success) revalidarModulo();
  return res;
}

export async function duplicarTarea(datos: NewTaskState): Promise<ActionResult<{ id: string }>> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const res = await insertarTarea(ctx, datos, { resetChecklist: true });
  if (res.success) revalidarModulo();
  return res;
}

export async function actualizarTarea(id: string, updates: ActualizarTareaInput): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, id);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t)) return fail('No tienes permisos para editar esta actividad.');

  const actual = t.row;
  // Solo se aceptan campos de una lista blanca (el estado lo decide el servidor)
  const cambios: Record<string, unknown> = { revisado_por: null };

  if (updates.title !== undefined) {
    const titulo = String(updates.title).trim();
    if (!titulo) return fail('El título es obligatorio.');
    cambios.titulo = titulo;
  }
  if (updates.description !== undefined) {
    cambios.descripcion = updates.description?.toString().trim() || null;
  }

  let cambioFecha = false;
  if (updates.due_date) {
    const fecha = new Date(updates.due_date);
    if (Number.isNaN(fecha.getTime())) return fail('La fecha límite no es válida.');
    cambioFecha = new Date(actual.fecha_limite).getTime() !== fecha.getTime();
    cambios.fecha_limite = fecha.toISOString();
  }

  let cambioAsignado = false;
  if (updates.assigned_to && updates.assigned_to !== actual.encargado_id) {
    const perfil = construirPerfil(ctx, await cargarEstructura(ctx));
    if (!perfil.esJefe && !t.esMiembroComision) {
      return fail('Solo una jefatura o integrante de la comisión puede reasignar la actividad.');
    }
    const validos = await usuariosDelMunicipio(ctx, [updates.assigned_to]);
    if (t.esTareaComision) {
      const { data: intRow } = await ctx.supabase
        .from('comision_integrantes')
        .select('id_integrante')
        .eq('id_integrante', updates.assigned_to)
        .limit(1)
        .maybeSingle();
      if (intRow?.id_integrante) validos.add(String(intRow.id_integrante));
    }
    if (!validos.has(updates.assigned_to)) return fail('El encargado seleccionado no pertenece al municipio.');

    const esSuperEditor = (ctx.rol || '').toLowerCase().trim() === 'super';
    if (!esSuperEditor && updates.assigned_to !== ctx.userId) {
      const { data: superTarget } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('id', updates.assigned_to)
        .eq('rol', 'super')
        .maybeSingle();
      if (superTarget) {
        return fail('Solo un Super Administrador puede asignar actividades a otro Super Administrador.');
      }
    }
    cambioAsignado = true;
    cambios.encargado_id = updates.assigned_to;
  }

  const estabaCompletada = normalizarEstado(actual.estado) === ESTADOS_TAREA.COMPLETADO;

  if (cambioAsignado) {
    // Nuevo encargado: requiere nuevo acuse de recibo
    cambios.fecha_confirmacion = null;
    cambios.estado = ESTADOS_TAREA.ASIGNADO;
    cambios.actualizado_en = null;
  } else if (cambioFecha && estabaCompletada) {
    cambios.estado = estadoReabierto(actual);
    cambios.actualizado_en = null;
  }

  const { error } = await ctx.supabase.from(T_ACTIVIDADES).update(cambios).eq('id', id);
  if (error) return fail(error.message);

  // Evitar que el nuevo encargado figure también como miembro
  if (cambioAsignado) {
    await ctx.supabase.from(T_MIEMBROS).delete().eq('actividad_id', id).eq('usuario_id', updates.assigned_to as string);
  }

  revalidarModulo();
  return ok();
}

export async function actualizarArchivosTarea(taskId: string, nuevosArchivos: ArchivoAdjunto[]): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t) && !t.esMiembro) return fail('No tienes permisos sobre esta actividad.');

  const archivos = (Array.isArray(nuevosArchivos) ? nuevosArchivos : [])
    .filter((a) => a && a.id && a.url && (a.tipo === 'pdf' || a.tipo === 'enlace'))
    .map((a) => ({
      id: String(a.id),
      tipo: a.tipo,
      nombre: String(a.nombre || a.url),
      url: String(a.url),
      ...(a.ruta_storage ? { ruta_storage: String(a.ruta_storage) } : {}),
      ...(a.cargado_por ? { cargado_por: String(a.cargado_por) } : {}),
    }));

  const cambios: Record<string, unknown> = { archivos, revisado_por: null };
  // Invalidación por modificación de archivos
  if (normalizarEstado(t.row.estado) === ESTADOS_TAREA.COMPLETADO) {
    cambios.estado = estadoReabierto(t.row);
    cambios.actualizado_en = null;
  }

  const { error } = await ctx.supabase.from(T_ACTIVIDADES).update(cambios).eq('id', taskId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

export async function updateChecklist(taskId: string, newChecklist: ChecklistItem[]): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t)) return fail('No tienes permisos para modificar el checklist.');

  const checklist = normalizarChecklist(newChecklist);
  const cambios: Record<string, unknown> = { checklist: checklistADb(checklist), revisado_por: null };

  if (normalizarEstado(t.row.estado) === ESTADOS_TAREA.COMPLETADO) {
    const todoCompleto = checklist.every((c) => c.is_completed);
    if (!todoCompleto) {
      cambios.estado = estadoReabierto(t.row);
      cambios.actualizado_en = null;
    }
  }

  const { error } = await ctx.supabase.from(T_ACTIVIDADES).update(cambios).eq('id', taskId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

export async function cambiarEstado(taskId: string, nuevoEstado: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const estadoNormalizado = normalizarEstado(nuevoEstado);
  if (!estadoNormalizado) return fail('Estado no válido.');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t)) return fail('No tienes permisos para cambiar el estado de esta actividad.');

  if (estadoNormalizado === ESTADOS_TAREA.COMPLETADO) {
    if (!t.esEncargado) {
      return fail('Solo la persona asignada a la actividad puede marcarla como completada.');
    }

    const pendientes: string[] = [];

    // 1. Checklist del encargado
    const lista = normalizarChecklist(t.row.checklist);
    const pendientesChecklist = lista.filter((i) => !i.is_completed).length;
    if (pendientesChecklist > 0) {
      pendientes.push(`el encargado tiene ${pendientesChecklist} pendiente(s) en su checklist`);
    }

    // 2. Todos los miembros deben haber entregado su parte
    const { data: miembros } = await ctx.supabase
      .from(T_MIEMBROS)
      .select('usuario_id, fecha_finalizacion')
      .eq('actividad_id', taskId);

    const sinEntregar = (miembros || []).filter((m) => !m.fecha_finalizacion);
    if (sinEntregar.length > 0) {
      const { data: perfiles } = await ctx.supabase
        .from('profiles')
        .select('id, nombre')
        .in('id', sinEntregar.map((m) => m.usuario_id));
      const nombres = (perfiles || []).map((p) => p.nombre).filter(Boolean);
      pendientes.push(
        `${sinEntregar.length} participante(s) no han completado su parte${nombres.length ? `: ${nombres.join(', ')}` : ''}`,
      );
    }

    if (pendientes.length > 0) {
      return fail(`No se puede completar la actividad: ${pendientes.join('; ')}.`);
    }
  }

  const cambios =
    estadoNormalizado === ESTADOS_TAREA.COMPLETADO
      ? { estado: estadoNormalizado, actualizado_en: new Date().toISOString() }
      : { estado: estadoNormalizado, actualizado_en: null, revisado_por: null };

  const { error } = await ctx.supabase.from(T_ACTIVIDADES).update(cambios).eq('id', taskId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

export async function eliminarTarea(taskId: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (t.esTareaComision) {
    if (!(t.esCreador || t.esMiembroComision)) {
      return fail('Solo los integrantes de la comisión o un Super Administrador pueden eliminar esta actividad.');
    }
  } else if (!(t.esCreador || t.esJefeDelEncargado || ctx.esSupervisor)) {
    return fail('Solo quien creó la actividad o una jefatura puede eliminarla.');
  }

  // Limpieza de PDFs en storage (best-effort)
  const rutas = (Array.isArray(t.row.archivos) ? t.row.archivos : [])
    .map((a: ArchivoAdjunto) => a?.ruta_storage)
    .filter((r: string | undefined): r is string => !!r);
  if (rutas.length > 0) {
    const { error: errStorage } = await ctx.supabase.storage.from(BUCKET_ARCHIVOS_TAREAS).remove(rutas);
    if (errStorage) console.error('[tareas] Error eliminando archivos de storage:', errStorage);
  }

  // Miembros y enlaces COMUDE se eliminan en cascada (ON DELETE CASCADE)
  const { error } = await ctx.supabase.from(T_ACTIVIDADES).delete().eq('id', taskId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

// ═════════════════════════════════════════════════════════════════════════════
// Acuse de recibo (bloqueo global)
// ═════════════════════════════════════════════════════════════════════════════

export async function obtenerActividadPendienteConfirmacion(): Promise<{
  success: boolean;
  data: ActividadPendiente | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, data: null };

  let pendiente: any = null;
  let rol: 'encargado' | 'miembro' = 'encargado';
  let idMiembro: string | null = null;

  // Paso 1: como encargado principal
  const { data: comoEncargado, error: errEncargado } = await supabase
    .from(T_ACTIVIDADES)
    .select('id, titulo, descripcion, fecha_limite, creador_id, encargado_id')
    .eq('encargado_id', user.id)
    .is('fecha_confirmacion', null)
    .neq('estado', ESTADOS_TAREA.COMPLETADO)
    .order('creado_en', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errEncargado) {
    console.error('[tareas] Error buscando pendiente (encargado):', errEncargado);
    return { success: false, data: null };
  }

  if (comoEncargado) {
    pendiente = comoEncargado;
  } else {
    // Paso 2: como miembro colaborador (la actividad padre no debe estar completada)
    const { data: filasMiembro, error: errMiembro } = await supabase
      .from(T_MIEMBROS)
      .select('id, actividad_id')
      .eq('usuario_id', user.id)
      .is('fecha_confirmacion', null)
      .order('creado_en', { ascending: true })
      .limit(25);

    if (errMiembro) {
      console.error('[tareas] Error buscando pendiente (miembro):', errMiembro);
      return { success: false, data: null };
    }

    if (filasMiembro && filasMiembro.length > 0) {
      const { data: padres } = await supabase
        .from(T_ACTIVIDADES)
        .select('id, titulo, descripcion, fecha_limite, creador_id, encargado_id')
        .in('id', filasMiembro.map((m) => m.actividad_id))
        .neq('estado', ESTADOS_TAREA.COMPLETADO);

      const padrePorId = new Map((padres || []).map((p) => [String(p.id), p]));
      const fila = filasMiembro.find((m) => padrePorId.has(String(m.actividad_id)));
      if (fila) {
        pendiente = padrePorId.get(String(fila.actividad_id));
        rol = 'miembro';
        idMiembro = String(fila.id);
      }
    }
  }

  if (!pendiente) return { success: true, data: null };

  const contexto = await obtenerContextoComude(supabase, [String(pendiente.id)]);
  const comude = contexto.get(String(pendiente.id));

  let creadorNombre = REMITENTE_COMUDE;
  if (!comude) {
    const { data: creador } = await supabase.from('profiles').select('nombre').eq('id', pendiente.creador_id).maybeSingle();
    creadorNombre = creador?.nombre || 'Desconocido';
  }

  return {
    success: true,
    data: {
      id: String(pendiente.id),
      title: pendiente.titulo,
      description: pendiente.descripcion ?? null,
      due_date: pendiente.fecha_limite,
      created_by: pendiente.creador_id,
      assigned_to: pendiente.encargado_id,
      creador_nombre: creadorNombre,
      es_concejo: !!comude,
      punto_titulo: comude?.punto_titulo ?? null,
      agenda_titulo: comude?.agenda_titulo ?? null,
      rol_confirmacion: rol,
      id_miembro: idMiembro,
    },
  };
}

export async function confirmarActividad(
  id: string,
  rol_confirmacion: 'encargado' | 'miembro' = 'encargado',
  id_miembro?: string | null,
): Promise<{ success: boolean; error?: string; confirmed_at?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  const confirmedAt = new Date().toISOString();

  if (rol_confirmacion === 'encargado') {
    const { data, error } = await supabase
      .from(T_ACTIVIDADES)
      .update({
        fecha_confirmacion: confirmedAt,
        estado: ESTADOS_TAREA.EN_PROCESO,
      })
      .eq('id', id)
      .eq('encargado_id', user.id)
      .is('fecha_confirmacion', null)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[tareas] Error confirmando (encargado):', error);
      return { success: false, error: error.message };
    }
    if (!data) return { success: false, error: 'No se pudo confirmar la actividad' };
  } else if (rol_confirmacion === 'miembro' && id_miembro) {
    const { data, error } = await supabase
      .from(T_MIEMBROS)
      .update({ fecha_confirmacion: confirmedAt })
      .eq('id', id_miembro)
      .eq('usuario_id', user.id)
      .is('fecha_confirmacion', null)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[tareas] Error confirmando (miembro):', error);
      return { success: false, error: error.message };
    }
    if (!data) return { success: false, error: 'No se pudo confirmar la actividad grupal' };
  } else {
    return { success: false, error: 'Datos de confirmación incompletos' };
  }

  revalidarModulo();
  return { success: true, confirmed_at: confirmedAt };
}

// ═════════════════════════════════════════════════════════════════════════════
// Miembros grupales
// ═════════════════════════════════════════════════════════════════════════════

async function cargarMiembroAutorizado(ctx: Contexto, miembroId: string) {
  const { data: miembro } = await ctx.supabase.from(T_MIEMBROS).select('*').eq('id', miembroId).maybeSingle();
  if (!miembro) return null;
  const tarea = await cargarTareaAutorizada(ctx, String(miembro.actividad_id));
  if (!tarea) return null;
  return { miembro, tarea, esElMiembro: miembro.usuario_id === ctx.userId };
}

/** Reabre la actividad principal si estaba completada (invalida revisión y cierre) */
async function reabrirSiCompletada(ctx: Contexto, row: any) {
  if (normalizarEstado(row.estado) !== ESTADOS_TAREA.COMPLETADO) return;
  await ctx.supabase
    .from(T_ACTIVIDADES)
    .update({ estado: estadoReabierto(row), revisado_por: null, actualizado_en: null })
    .eq('id', row.id);
}

/** Trae todos los miembros de una tarea con su nombre resuelto. */
export async function obtenerMiembrosDeTarea(taskId: string): Promise<ActMiembro[]> {
  const ctx = await obtenerContexto();
  if (!ctx) return [];
  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return [];

  const { data: miembros, error } = await ctx.supabase
    .from(T_MIEMBROS)
    .select('*')
    .eq('actividad_id', taskId)
    .order('creado_en', { ascending: true });
  if (error || !miembros) return [];

  const { data: perfiles } = await ctx.supabase
    .from('profiles')
    .select('id, nombre')
    .in('id', miembros.map((m) => m.usuario_id));
  const nombres = new Map((perfiles || []).map((p) => [String(p.id), p.nombre as string]));

  return miembros.map((m) => mapMiembro(m, nombres.get(String(m.usuario_id))));
}

/** Agrega un nuevo miembro a una actividad grupal y envía la notificación. */
export async function agregarMiembro(
  taskId: string,
  userId: string,
  asignaciones: AsignacionMiembro[],
  tituloTarea: string,
): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t)) return fail('No tienes permisos para agregar participantes.');
  if (userId === t.row.encargado_id) return fail('El encargado no puede ser agregado como participante.');

  const validos = await usuariosDelMunicipio(ctx, [userId]);
  if (t.esTareaComision) {
    const { data: intRow } = await ctx.supabase
      .from('comision_integrantes')
      .select('id_integrante')
      .eq('id_integrante', userId)
      .limit(1)
      .maybeSingle();
    if (intRow?.id_integrante) validos.add(String(intRow.id_integrante));
  }
  if (!validos.has(userId)) return fail('El participante no pertenece al municipio.');

  const { error } = await ctx.supabase.from(T_MIEMBROS).insert({
    actividad_id: taskId,
    usuario_id: userId,
    asignaciones: asignacionesADb(normalizarAsignaciones(asignaciones)),
  });
  if (error) {
    if (error.code === '23505') return fail('Esta persona ya es participante de la actividad.');
    return fail(error.message);
  }

  // Un nuevo participante con trabajo pendiente invalida el cierre
  await reabrirSiCompletada(ctx, t.row);

  try {
    await sendPushToUsers([userId], {
      title: '👥 Nueva Actividad Grupal',
      body: `Se te ha asignado como participante en: "${tituloTarea || t.row.titulo}"`,
      url: RUTAS_TAREAS.mis_actividades,
    });
  } catch (pushErr) {
    console.error('[tareas] Error enviando push de participante:', pushErr);
  }

  revalidarModulo();
  return ok();
}

/** Elimina un miembro de una actividad grupal. */
export async function eliminarMiembro(miembroId: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const m = await cargarMiembroAutorizado(ctx, miembroId);
  if (!m) return fail('Participante no encontrado.');
  if (!puedeGestionar(ctx, m.tarea)) return fail('No tienes permisos para quitar participantes.');

  const { error } = await ctx.supabase.from(T_MIEMBROS).delete().eq('id', miembroId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

/**
 * Actualiza las asignaciones (sub-tareas) de un miembro.
 * Si no están todas completas, limpia fecha_finalizacion y reabre la actividad si estaba completada.
 */
export async function actualizarAsignacionesMiembro(
  miembroId: string,
  asignaciones: AsignacionMiembro[],
): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const m = await cargarMiembroAutorizado(ctx, miembroId);
  if (!m) return fail('Participante no encontrado.');
  if (!m.esElMiembro && !puedeGestionar(ctx, m.tarea)) return fail('No tienes permisos sobre estas asignaciones.');

  const lista = normalizarAsignaciones(asignaciones);
  const todasCompletas = lista.every((a) => a.is_complete);
  const cambios: Record<string, unknown> = { asignaciones: asignacionesADb(lista) };
  if (!todasCompletas) cambios.fecha_finalizacion = null;

  const { error } = await ctx.supabase.from(T_MIEMBROS).update(cambios).eq('id', miembroId);
  if (error) return fail(error.message);

  if (!todasCompletas) await reabrirSiCompletada(ctx, m.tarea.row);

  revalidarModulo();
  return ok();
}

/** Marca la parte del miembro como completada (requiere todas sus asignaciones completas). */
export async function marcarParteMiembroCompletada(miembroId: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const m = await cargarMiembroAutorizado(ctx, miembroId);
  if (!m) return fail('Participante no encontrado.');
  if (!m.esElMiembro && !puedeGestionar(ctx, m.tarea)) return fail('No tienes permisos para entregar esta parte.');

  const lista = normalizarAsignaciones(m.miembro.asignaciones);
  const pendientes = lista.filter((a) => !a.is_complete).length;
  if (pendientes > 0) {
    return fail(`Aún hay ${pendientes} asignación(es) pendiente(s) antes de completar tu parte.`);
  }

  const { error } = await ctx.supabase
    .from(T_MIEMBROS)
    .update({ fecha_finalizacion: new Date().toISOString() })
    .eq('id', miembroId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

/** Actualiza el comentario de entrega de un miembro. */
export async function actualizarComentarioMiembro(miembroId: string, comentario: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const m = await cargarMiembroAutorizado(ctx, miembroId);
  if (!m) return fail('Participante no encontrado.');
  if (!m.esElMiembro && !puedeGestionar(ctx, m.tarea)) return fail('No tienes permisos para comentar.');

  const { error } = await ctx.supabase
    .from(T_MIEMBROS)
    .update({ comentarios: comentario?.trim() || null })
    .eq('id', miembroId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

// ═════════════════════════════════════════════════════════════════════════════
// Revisión
// ═════════════════════════════════════════════════════════════════════════════

/** Marca la actividad como revisada y guarda quién la revisó con fecha y hora. */
export async function marcarComoRevisado(taskId: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t)) return fail('No tienes permisos para revisar esta actividad.');
  if (t.row.estado !== ESTADOS_TAREA.COMPLETADO) return fail('Solo se pueden revisar actividades completadas.');

  const { error } = await ctx.supabase
    .from(T_ACTIVIDADES)
    .update({ revisado_por: { nombre: ctx.nombre, fecha: new Date().toISOString() } })
    .eq('id', taskId);
  if (error) return fail(error.message);
  revalidarModulo();
  return ok();
}

/** Marca la actividad como revisada por el COMUDE (para el seguimiento desde la sesión). */
export async function marcarRevisadoPorComude(taskId: string): Promise<ActionResult> {
  const ctx = await obtenerContexto();
  if (!ctx) return fail('No autenticado');

  const t = await cargarTareaAutorizada(ctx, taskId);
  if (!t) return fail('Actividad no encontrada.');
  if (!puedeGestionar(ctx, t)) return fail('No tienes permisos para revisar esta actividad.');
  if (t.row.estado !== ESTADOS_TAREA.COMPLETADO) return fail('Solo se pueden revisar actividades completadas.');

  const { error } = await ctx.supabase
    .from(T_ACTIVIDADES)
    .update({ revisado_por: { nombre: 'COMUDE', fecha: new Date().toISOString() } })
    .eq('id', taskId);
  if (error) return fail(error.message);
  revalidarModulo();
  revalidatePath('/comude/comude', 'layout');
  return ok();
}

// ═════════════════════════════════════════════════════════════════════════════
// Actividades de Comisión (tra_actividad_comision_enlaces)
// ═════════════════════════════════════════════════════════════════════════════

export async function obtenerActividadesDeComision(
  comisionId: string,
  año: number,
): Promise<{ tareas: Tarea[]; usuarios: Usuario[] }> {
  const ctx = await obtenerContexto();
  if (!ctx || !ctx.municipioId || !comisionId) return { tareas: [], usuarios: [] };

  const supabase = ctx.supabase;
  const municipioId = ctx.municipioId;

  const { data: comision } = await supabase
    .from('comisiones')
    .select('id, nombre, municipio_id')
    .eq('id', comisionId)
    .maybeSingle();

  if (!comision || Number(comision.municipio_id) !== Number(municipioId)) {
    return { tareas: [], usuarios: [] };
  }

  const estructura = await cargarEstructura(ctx);

  // 1. Integrantes de la comisión para el año seleccionado (usuarios asignables)
  const { data: intRows } = await supabase
    .from('comision_integrantes')
    .select('id_integrante')
    .eq('id_comision', comisionId)
    .eq('año', año);

  const integranteIds = Array.from(
    new Set((intRows || []).map((r: any) => String(r.id_integrante)).filter(Boolean)),
  );

  // 2. Enlaces de actividades de esta comisión
  const { data: enlaces } = await supabase
    .from(T_ENLACES_COMISION)
    .select('actividad_id')
    .eq('comision_id', comisionId);

  const actividadIds = Array.from(
    new Set((enlaces || []).map((e: any) => String(e.actividad_id)).filter(Boolean)),
  );

  let rawTareas: any[] = [];
  if (actividadIds.length > 0) {
    const todas = await selectEnChunks(
      (chunk) => supabase.from(T_ACTIVIDADES).select('*').eq('municipio_id', municipioId).in('id', chunk),
      actividadIds,
    );
    rawTareas = todas.filter((row: any) => {
      const añoLimite = row.fecha_limite ? new Date(row.fecha_limite).getFullYear() : null;
      const añoCreado = row.creado_en ? new Date(row.creado_en).getFullYear() : null;
      return añoLimite === año || añoCreado === año;
    });
  }

  const taskIds = rawTareas.map((t) => String(t.id));

  // 3. Miembros grupales
  let rawMiembros: any[] = [];
  if (taskIds.length > 0) {
    rawMiembros = await selectEnChunks(
      (chunk) => supabase.from(T_MIEMBROS).select('*').in('actividad_id', chunk).order('creado_en', { ascending: true }),
      taskIds,
    );
  }

  // 4. Cargar perfiles necesarios (integrantes + creadores + encargados + miembros)
  const profileIdsToFetch = new Set<string>(integranteIds);
  rawTareas.forEach((t: any) => {
    if (t.creador_id) profileIdsToFetch.add(String(t.creador_id));
    if (t.encargado_id) profileIdsToFetch.add(String(t.encargado_id));
  });
  rawMiembros.forEach((m: any) => {
    if (m.usuario_id) profileIdsToFetch.add(String(m.usuario_id));
  });

  const esSuper = (ctx.rol || '').toLowerCase().trim() === 'super';
  const usuarioPorId = new Map<string, Usuario>();

  if (profileIdsToFetch.size > 0) {
    const perfiles = await selectEnChunks<ProfileRow>(
      (chunk) => supabase.from('profiles').select('id, nombre, activo, puesto_id, rol').in('id', chunk),
      Array.from(profileIdsToFetch),
    );
    perfiles.forEach((u) => {
      usuarioPorId.set(String(u.id), mapUsuario(u, estructura));
    });
  }

  const usuariosComision: Usuario[] = integranteIds
    .map((id) => usuarioPorId.get(id))
    .filter((u): u is Usuario => !!u && (esSuper || (u.rol || '').toLowerCase().trim() !== 'super'))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const miembrosPorTarea = new Map<string, ActMiembro[]>();
  rawMiembros.forEach((m: any) => {
    const nombre = usuarioPorId.get(String(m.usuario_id))?.nombre || 'Usuario';
    const lista = miembrosPorTarea.get(String(m.actividad_id)) || [];
    lista.push(mapMiembro(m, nombre));
    miembrosPorTarea.set(String(m.actividad_id), lista);
  });

  const tareas: Tarea[] = rawTareas.map((row) => {
    const t = mapTarea(row);
    const creador = usuarioPorId.get(t.created_by);
    const asignado = t.assigned_to ? usuarioPorId.get(t.assigned_to) : undefined;

    return {
      ...t,
      comision_id: comisionId,
      comision_nombre: String(comision.nombre || 'Comisión'),
      creator: { nombre: creador?.nombre || 'Desconocido' },
      assignee: {
        nombre: asignado?.nombre || 'Sin asignar',
        oficina_nombre: asignado?.oficina_nombre || 'Integrante de Comisión',
      },
      miembros: miembrosPorTarea.get(t.id) || [],
    };
  });

  tareas.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  return { tareas, usuarios: usuariosComision };
}

// Aliases para terminología unificada de Actividad
export const crearActividad = crearTarea;
export const duplicarActividad = duplicarTarea;
export const actualizarActividad = actualizarTarea;
export const actualizarArchivosActividad = actualizarArchivosTarea;
export const actualizarChecklistActividad = updateChecklist;
export const cambiarStatusActividad = cambiarEstado;
export const eliminarActividad = eliminarTarea;
export const obtenerMiembrosDeActividad = obtenerMiembrosDeTarea;
export const agregarMiembroAActividad = agregarMiembro;
