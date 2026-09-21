"use server";

import { createClient } from "@/utils/supabase/server";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";
import {
  comunidadFormSchema,
  asignarPersonaComunidadSchema,
  type ComunidadRecord,
  type ComunidadFormValues,
  type AsignarPersonaComunidadValues,
  type NodoTerritorial,
  type TipoLugar,
  type PersonaTerritorioOption,
  type PersonaResidente,
} from "./zod";
import type { PuestoRecord } from "../../organizacion-jerarquica/lib/zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ActionResult = { success: boolean; error: string | null };

async function requireAdmin(): Promise<
  | { supabase: SupabaseServerClient; municipioId: number; error: null }
  | { supabase: null; municipioId: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase: null, municipioId: null, error: "UNAUTHORIZED" };

  const role = (user.user_metadata?.rol || user.role || "user") as string;
  if (!isSuperOrAdminRole(role))
    return { supabase: null, municipioId: null, error: "FORBIDDEN" };

  // Obtener municipio_id: primero de la cookie global, luego del perfil
  const cookie = await getGlobalMunicipioCookie();
  if (cookie?.id) {
    return { supabase, municipioId: cookie.id, error: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("municipio_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.municipio_id) {
    return { supabase: null, municipioId: null, error: "NO_MUNICIPIO" };
  }

  return { supabase, municipioId: profile.municipio_id as number, error: null };
}

function construirArbol(
  comunidades: ComunidadRecord[],
  residentesMap: Map<string, PersonaResidente[]>,
  puestosPorComunidadMap: Map<string, PuestoRecord[]>,
  periodosMap: Map<string, any>,
): NodoTerritorial[] {
  const hijosPorPadre = new Map<string | null, ComunidadRecord[]>();

  for (const c of comunidades) {
    const lista = hijosPorPadre.get(c.parent_id) ?? [];
    lista.push(c);
    hijosPorPadre.set(c.parent_id, lista);
  }

  function buildNode(c: ComunidadRecord): NodoTerritorial {
    const hijos = (hijosPorPadre.get(c.id) ?? [])
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(buildNode);

    const directResidentes = residentesMap.get(c.id) ?? [];
    const directCount = directResidentes.length;
    const hijosCount = hijos.reduce((acc, h) => acc + h.personas_count, 0);
    const puestos = puestosPorComunidadMap.get(c.id) ?? [];
    const resolucion_vigente = periodosMap.get(c.id) ?? null;

    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo as TipoLugar,
      personas_count: directCount + hijosCount,
      residentes: directResidentes,
      hijos,
      puestos,
      resolucion_vigente,
    };
  }

  return (hijosPorPadre.get(null) ?? [])
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(buildNode);
}

// ─── Server Actions (solo funciones async) ────────────────────────────────────

export async function getEstructuraTerritorial(): Promise<{
  data: NodoTerritorial[];
  municipioId: number | null;
  error: string | null;
}> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase)
      return { data: [], municipioId: null, error };

    const [comunidadesRes, profilesRes, deptosComRes, periodosRes] = await Promise.all([
      supabase
        .from("lug_comunidades")
        .select("id, municipio_id, parent_id, nombre, tipo")
        .eq("municipio_id", municipioId)
        .order("nombre"),
      supabase
        .from("profiles")
        .select("id, nombre, email, dpi, comunidad_id")
        .eq("activo", true)
        .eq("municipio_id", municipioId)
        .not("comunidad_id", "is", null),
      supabase
        .from("departamentos")
        .select("id, comunidad_id")
        .eq("municipio_id", municipioId)
        .not("comunidad_id", "is", null),
      supabase
        .from("cocode_periodos")
        .select("*")
        .eq("municipio_id", municipioId)
        .eq("activo", true),
    ]);

    if (comunidadesRes.error) return { data: [], municipioId, error: "LOAD_FAILED" };

    const periodosMap = new Map<string, any>();
    if (!periodosRes.error && periodosRes.data) {
      for (const p of periodosRes.data) {
        const resolucionObj =
          typeof p.resolucion === "string" ? JSON.parse(p.resolucion) : p.resolucion;
        const { estado, diasRestantes } = calcularEstadoVigencia(p.fecha_vencimiento);
        periodosMap.set(p.comunidad_id, {
          ...p,
          resolucion: resolucionObj,
          estado_vigencia: estado,
          dias_restantes: diasRestantes,
        });
      }
    }

    const residentesMap = new Map<string, PersonaResidente[]>();
    if (!profilesRes.error && profilesRes.data) {
      for (const row of profilesRes.data) {
        if (row.comunidad_id) {
          const list = residentesMap.get(row.comunidad_id) ?? [];
          list.push({
            id: String(row.id),
            nombre: String(row.nombre ?? ""),
            email: row.email ?? null,
            dpi: row.dpi ?? null,
          });
          residentesMap.set(row.comunidad_id, list);
        }
      }
    }

    // Cargar puestos de comunidades
    const puestosPorComunidadMap = new Map<string, PuestoRecord[]>();
    if (!deptosComRes.error && deptosComRes.data && deptosComRes.data.length > 0) {
      const deptoIdToComunidadId = new Map(deptosComRes.data.map((d) => [d.id, d.comunidad_id]));
      const deptoIds = Array.from(deptoIdToComunidadId.keys());

      const [puestosRes, jefaturasRes, titularesRes] = await Promise.all([
        supabase
          .from("puestos")
          .select("id, nombre, departamento_id, activo, fecha, acreditaciones")
          .in("departamento_id", deptoIds)
          .order("nombre"),
        supabase
          .from("puesto_jefaturas")
          .select("puesto_id, departamento_id")
          .in("departamento_id", deptoIds),
        supabase
          .from("profiles")
          .select("id, nombre, puesto_id")
          .eq("municipio_id", municipioId)
          .not("puesto_id", "is", null),
      ]);

      if (!puestosRes.error && puestosRes.data) {
        const jefesSet = new Set((jefaturasRes.data ?? []).map((j) => j.puesto_id));
        const titularesMap = new Map((titularesRes.data ?? []).map((p) => [p.puesto_id, String(p.nombre ?? "")]));

        for (const p of puestosRes.data) {
          const comId = deptoIdToComunidadId.get(p.departamento_id);
          if (!comId) continue;

          let acreditaciones = [];
          if (Array.isArray(p.acreditaciones)) {
            acreditaciones = p.acreditaciones;
          } else if (typeof p.acreditaciones === "string") {
            try { acreditaciones = JSON.parse(p.acreditaciones); } catch {}
          }

          const record: PuestoRecord = {
            id: String(p.id),
            nombre: String(p.nombre ?? ""),
            departamento_id: p.departamento_id,
            jefatura_ids: jefesSet.has(p.id) ? [p.departamento_id] : [],
            jefaturas_nombres: jefesSet.has(p.id) ? ["Jefatura"] : [],
            orden: 0,
            activo: p.activo !== false,
            fecha: p.fecha ? String(p.fecha).split("T")[0] : null,
            acreditaciones,
            titular: titularesMap.get(p.id) ?? null,
          };

          const list = puestosPorComunidadMap.get(comId) ?? [];
          list.push(record);
          puestosPorComunidadMap.set(comId, list);
        }
      }
    }

    const comunidades = (comunidadesRes.data ?? []) as ComunidadRecord[];
    return { data: construirArbol(comunidades, residentesMap, puestosPorComunidadMap, periodosMap), municipioId, error: null };
  } catch {
    return { data: [], municipioId: null, error: "LOAD_FAILED" };
  }
}

export async function getPersonasParaAsignarTerritorio(comunidadId: string): Promise<{
  personas: PersonaTerritorioOption[];
  error: string | null;
}> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { personas: [], error };

    const [profilesRes, comunidadesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nombre, email, dpi, comunidad_id")
        .eq("activo", true)
        .eq("municipio_id", municipioId)
        .order("nombre"),
      supabase
        .from("lug_comunidades")
        .select("id, nombre")
        .eq("municipio_id", municipioId),
    ]);

    if (profilesRes.error) return { personas: [], error: "LOAD_PROFILES_FAILED" };

    const comunidadesMap = new Map<string, string>(
      (comunidadesRes.data ?? []).map((c) => [c.id, c.nombre]),
    );

    const personas: PersonaTerritorioOption[] = (profilesRes.data ?? []).map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre ?? ""),
      email: p.email ?? null,
      dpi: p.dpi ?? null,
      comunidad_id: p.comunidad_id ?? null,
      comunidad_nombre: p.comunidad_id ? (comunidadesMap.get(p.comunidad_id) ?? null) : null,
    }));

    return { personas, error: null };
  } catch {
    return { personas: [], error: "LOAD_PROFILES_FAILED" };
  }
}

export async function asignarPersonaATerritorio(
  values: AsignarPersonaComunidadValues,
): Promise<ActionResult> {
  try {
    const { supabase, error } = await requireAdmin();
    if (error || !supabase) return { success: false, error };

    const parsed = asignarPersonaComunidadSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { profile_id, comunidad_id } = parsed.data;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ comunidad_id })
      .eq("id", profile_id);

    if (updateError) return { success: false, error: "ASSIGN_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "ASSIGN_FAILED" };
  }
}

export async function createComunidad(
  values: ComunidadFormValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { success: false, error };

    const parsed = comunidadFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const id = `${parsed.data.tipo}_${Date.now()}`;

    const { error: insertError } = await supabase.from("lug_comunidades").insert({
      id,
      municipio_id: municipioId,
      parent_id: parsed.data.parent_id,
      nombre: parsed.data.nombre.trim(),
      tipo: parsed.data.tipo,
    });

    if (insertError) return { success: false, error: "SAVE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function updateComunidad(
  id: string,
  values: ComunidadFormValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { success: false, error };

    const parsed = comunidadFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { error: updateError } = await supabase
      .from("lug_comunidades")
      .update({
        nombre: parsed.data.nombre.trim(),
        parent_id: parsed.data.parent_id,
      })
      .eq("id", id)
      .eq("municipio_id", municipioId);

    if (updateError) return { success: false, error: "SAVE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function deleteComunidad(id: string): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { success: false, error };

    const { count } = await supabase
      .from("lug_comunidades")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", id)
      .eq("municipio_id", municipioId);

    if ((count ?? 0) > 0) return { success: false, error: "HAS_CHILDREN" };

    const { error: deleteError } = await supabase
      .from("lug_comunidades")
      .delete()
      .eq("id", id)
      .eq("municipio_id", municipioId);

    if (deleteError) return { success: false, error: "DELETE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "DELETE_FAILED" };
  }
}

export async function obtenerOManutenerDepartamentoComunidad(comunidadId: string, comunidadNombre: string): Promise<{ departamentoId: string | null; error: string | null }> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { departamentoId: null, error };

    const { data: existente } = await supabase
      .from("departamentos")
      .select("id")
      .eq("comunidad_id", comunidadId)
      .eq("municipio_id", municipioId)
      .maybeSingle();

    if (existente?.id) {
      return { departamentoId: String(existente.id), error: null };
    }

    const { data: creado, error: insertError } = await supabase
      .from("departamentos")
      .insert({
        nombre: `Comunidad: ${comunidadNombre}`,
        comunidad_id: comunidadId,
        municipio_id: municipioId,
        orden: 0,
      })
      .select("id")
      .single();

    if (insertError || !creado?.id) {
      return { departamentoId: null, error: "CREATE_DEPTO_FAILED" };
    }

    return { departamentoId: String(creado.id), error: null };
  } catch {
    return { departamentoId: null, error: "CREATE_DEPTO_FAILED" };
  }
}

// ─── Server Actions para Resoluciones de COCODE ─────────────────────────────

function calcularEstadoVigencia(fechaVencimientoStr: string): {
  estado: "vigente" | "por_vencer" | "vencido";
  diasRestantes: number;
} {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(fechaVencimientoStr);
  vencimiento.setHours(0, 0, 0, 0);

  const diffTime = vencimiento.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { estado: "vencido", diasRestantes: diffDays };
  } else if (diffDays <= 60) {
    return { estado: "por_vencer", diasRestantes: diffDays };
  } else {
    return { estado: "vigente", diasRestantes: diffDays };
  }
}

export async function getResolucionVigenteComunidad(comunidadId: string) {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { data: null, error };

    const { data: periodo, error: selectError } = await supabase
      .from("cocode_periodos")
      .select("*")
      .eq("comunidad_id", comunidadId)
      .eq("municipio_id", municipioId)
      .eq("activo", true)
      .maybeSingle();

    if (selectError) return { data: null, error: "SELECT_FAILED" };
    if (!periodo) return { data: null, error: null };

    const { estado, diasRestantes } = calcularEstadoVigencia(periodo.fecha_vencimiento);

    const resolucionObj =
      typeof periodo.resolucion === "string"
        ? JSON.parse(periodo.resolucion)
        : periodo.resolucion;

    return {
      data: {
        ...periodo,
        resolucion: resolucionObj,
        estado_vigencia: estado,
        dias_restantes: diasRestantes,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "LOAD_FAILED" };
  }
}

export async function getHistorialResolucionesComunidad(comunidadId: string) {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { data: [], error };

    const { data: periodos, error: selectError } = await supabase
      .from("cocode_periodos")
      .select("*")
      .eq("comunidad_id", comunidadId)
      .eq("municipio_id", municipioId)
      .order("created_at", { ascending: false });

    if (selectError || !periodos) return { data: [], error: "SELECT_FAILED" };

    const periodoIds = periodos.map((p) => p.id);
    let historicosMap = new Map<string, any[]>();

    if (periodoIds.length > 0) {
      const { data: historicoRows } = await supabase
        .from("cocode_periodo_historico_puestos")
        .select("*")
        .in("periodo_id", periodoIds)
        .order("created_at", { ascending: true });

      if (historicoRows) {
        for (const row of historicoRows) {
          const list = historicosMap.get(row.periodo_id) ?? [];
          list.push(row);
          historicosMap.set(row.periodo_id, list);
        }
      }
    }

    const result = periodos.map((p) => {
      const resolucionObj =
        typeof p.resolucion === "string" ? JSON.parse(p.resolucion) : p.resolucion;
      const { estado, diasRestantes } = calcularEstadoVigencia(p.fecha_vencimiento);
      return {
        ...p,
        resolucion: resolucionObj,
        estado_vigencia: estado,
        dias_restantes: diasRestantes,
        historico_puestos: historicosMap.get(p.id) ?? [],
      };
    });

    return { data: result, error: null };
  } catch {
    return { data: [], error: "LOAD_FAILED" };
  }
}

export async function renovarResolucionCOCODE(payload: {
  comunidadId: string;
  titulo: string;
  archivos: Array<{ nombre: string; filePath: string }>;
  fechaEmision: string | null;
  fechaVencimiento: string;
  limpiarPuestosActuales?: boolean;
}): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { success: false, error };

    // 1. Obtener departamento_id de la comunidad
    const { data: depto } = await supabase
      .from("departamentos")
      .select("id")
      .eq("comunidad_id", payload.comunidadId)
      .eq("municipio_id", municipioId)
      .maybeSingle();

    // 2. Obtener periodo activo previo (si existe)
    const { data: periodoPrevio } = await supabase
      .from("cocode_periodos")
      .select("id")
      .eq("comunidad_id", payload.comunidadId)
      .eq("municipio_id", municipioId)
      .eq("activo", true)
      .maybeSingle();

    // 3. Si hay periodo previo, congelar directiva saliente en cocode_periodo_historico_puestos
    if (periodoPrevio?.id && depto?.id) {
      const [puestosRes, jefaturasRes, titularesRes] = await Promise.all([
        supabase
          .from("puestos")
          .select("id, nombre, fecha")
          .eq("departamento_id", depto.id),
        supabase
          .from("puesto_jefaturas")
          .select("puesto_id")
          .eq("departamento_id", depto.id),
        supabase
          .from("profiles")
          .select("id, nombre, puesto_id")
          .eq("municipio_id", municipioId)
          .not("puesto_id", "is", null),
      ]);

      if (puestosRes.data && puestosRes.data.length > 0) {
        const jefesSet = new Set((jefaturasRes.data ?? []).map((j) => j.puesto_id));
        const titularesMap = new Map(
          (titularesRes.data ?? []).map((t) => [t.puesto_id, String(t.nombre ?? "")])
        );

        const historicosToInsert = puestosRes.data.map((p) => ({
          periodo_id: periodoPrevio.id,
          nombre_puesto: p.nombre,
          es_presidente: jefesSet.has(p.id),
          titular_nombre: titularesMap.get(p.id) ?? null,
          fecha_asignacion: p.fecha ?? null,
        }));

        await supabase
          .from("cocode_periodo_historico_puestos")
          .insert(historicosToInsert);
      }

      // Marcar periodo previo como inactivo
      await supabase
        .from("cocode_periodos")
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq("id", periodoPrevio.id);
    }

    // 4. Crear nuevo periodo activo con arreglo de archivos
    const nowIso = new Date().toISOString();
    const archivosObj = (payload.archivos ?? []).map((a, idx) => ({
      id: `${Date.now()}_${idx}`,
      nombre: a.nombre,
      file_path: a.filePath,
      created_at: nowIso,
    }));

    const resolucionJson = {
      titulo: payload.titulo,
      archivos: archivosObj,
    };

    const { error: insertError } = await supabase.from("cocode_periodos").insert({
      comunidad_id: payload.comunidadId,
      municipio_id: municipioId,
      resolucion: resolucionJson,
      fecha_emision: payload.fechaEmision || null,
      fecha_vencimiento: payload.fechaVencimiento,
      activo: true,
    });

    if (insertError) return { success: false, error: "INSERT_FAILED" };

    // 5. Si se indicó desasignar personas de los puestos para la nueva directiva
    if (payload.limpiarPuestosActuales && depto?.id) {
      const { data: puestosCom } = await supabase
        .from("puestos")
        .select("id")
        .eq("departamento_id", depto.id);

      if (puestosCom && puestosCom.length > 0) {
        const puestoIds = puestosCom.map((p) => p.id);
        await supabase
          .from("profiles")
          .update({ puesto_id: null })
          .in("puesto_id", puestoIds);
      }
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "RENOVAR_FAILED" };
  }
}

export async function editarResolucionCOCODE(payload: {
  periodoId: string;
  titulo: string;
  archivos: Array<{ id?: string; nombre: string; file_path: string }>;
  fechaEmision: string | null;
  fechaVencimiento: string;
}): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdmin();
    if (error || !supabase) return { success: false, error };

    const nowIso = new Date().toISOString();
    const archivosObj = payload.archivos.map((a, idx) => ({
      id: a.id || `${Date.now()}_${idx}`,
      nombre: a.nombre,
      file_path: a.file_path,
      created_at: nowIso,
    }));

    const resolucionJson = {
      titulo: payload.titulo,
      archivos: archivosObj,
    };

    const { error: updateError } = await supabase
      .from("cocode_periodos")
      .update({
        resolucion: resolucionJson,
        fecha_emision: payload.fechaEmision || null,
        fecha_vencimiento: payload.fechaVencimiento,
        updated_at: nowIso,
      })
      .eq("id", payload.periodoId)
      .eq("municipio_id", municipioId);

    if (updateError) return { success: false, error: "UPDATE_FAILED" };

    return { success: true, error: null };
  } catch {
    return { success: false, error: "EDITAR_FAILED" };
  }
}


