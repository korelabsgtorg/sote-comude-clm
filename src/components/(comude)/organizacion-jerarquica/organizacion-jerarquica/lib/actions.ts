"use server";

import { createClient } from "@/utils/supabase/server";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";
import {
  asignarPersonaSchema,
  departamentoFormSchema,
  ESTRUCTURA_VACIA,
  puestoFormSchema,
  type AsignarPersonaValues,
  type DepartamentoFormValues,
  type DepartamentoRecord,
  type NodoOrganizacion,
  type ProfileOpcion,
  type PuestoFormValues,
  type PuestoRecord,
  type AcreditacionFile,
  buscarNodoPorId,
  reubicarPuestoSchema,
  type ReubicarPuestoValues,
  jefaturasPermitidas,
} from "./zod";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ActionResult = { success: boolean; error: string | null };

async function requireAdmin(): Promise<
  | { supabase: SupabaseServerClient; error: null }
  | { supabase: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: null, error: "UNAUTHORIZED" };
  }

  const role = (user.user_metadata?.rol || user.role || "user") as string;

  if (!isSuperOrAdminRole(role)) {
    return { supabase: null, error: "FORBIDDEN" };
  }

  return { supabase, error: null };
}

async function requireAdminConMunicipio(): Promise<
  | { supabase: SupabaseServerClient; municipioId: number; error: null }
  | { supabase: null; municipioId: null; error: string }
> {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { supabase: null, municipioId: null, error };

  const cookie = await getGlobalMunicipioCookie();
  if (cookie?.id) {
    return { supabase, municipioId: cookie.id, error: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, municipioId: null, error: "UNAUTHORIZED" };

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

function normalizarDepartamento(
  row: Record<string, unknown>,
): DepartamentoRecord {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    parent_id: (row.parent_id as string | null) ?? null,
    descripcion: (row.descripcion as string | null) ?? null,
    orden: typeof row.orden === "number" ? row.orden : 0,
    activo: row.activo !== false,
    comunidad_id: (row.comunidad_id as string | null) ?? null,
    jalar_jefes_territoriales: Boolean(row.jalar_jefes_territoriales),
  };
}

function normalizarPuesto(
  row: Record<string, unknown>,
  jefaturaIds: string[],
  jefaturasNombres: string[],
): PuestoRecord {
  let fecha = (row.fecha as string | null) ?? null;
  if (fecha) {
    fecha = fecha.split("T")[0].split(" ")[0];
  }

  let acreditaciones: AcreditacionFile[] = [];
  if (Array.isArray(row.acreditaciones)) {
    acreditaciones = row.acreditaciones as AcreditacionFile[];
  } else if (typeof row.acreditaciones === "string") {
    try {
      acreditaciones = JSON.parse(row.acreditaciones);
    } catch {
      acreditaciones = [];
    }
  }

  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    departamento_id: (row.departamento_id as string | null) ?? null,
    jefatura_ids: jefaturaIds,
    jefaturas_nombres: jefaturasNombres,
    orden: typeof row.orden === "number" ? row.orden : 0,
    activo: row.activo !== false,
    fecha,
    acreditaciones,
  };
}

const DEPARTAMENTOS_SELECT =
  "id, nombre, parent_id, descripcion, comunidad_id, orden, jalar_jefes_territoriales";
const DEPARTAMENTOS_SELECT_LEGACY =
  "id, nombre, parent_id, descripcion, comunidad_id, orden";
const DEPARTAMENTOS_SELECT_BASE = "id, nombre, parent_id, comunidad_id, orden";
const PUESTOS_SELECT_FULL = "id, nombre, departamento_id, orden, activo, fecha, acreditaciones";
const PUESTOS_SELECT_BASE = "id, nombre, departamento_id, activo, fecha, acreditaciones";

async function listarDepartamentos(supabase: SupabaseServerClient, municipioId: number) {
  const withJefes = await supabase
    .from("departamentos")
    .select(DEPARTAMENTOS_SELECT)
    .eq("municipio_id", municipioId)
    .order("orden", { ascending: true })
    .order("nombre");
  if (!withJefes.error) return withJefes;

  const withDesc = await supabase
    .from("departamentos")
    .select(DEPARTAMENTOS_SELECT_LEGACY)
    .eq("municipio_id", municipioId)
    .order("orden", { ascending: true })
    .order("nombre");
  if (!withDesc.error) return withDesc;

  return supabase
    .from("departamentos")
    .select(DEPARTAMENTOS_SELECT_BASE)
    .eq("municipio_id", municipioId)
    .order("orden", { ascending: true })
    .order("nombre");
}

async function listarPuestos(supabase: SupabaseServerClient, municipioId: number) {
  const full = await supabase
    .from("puestos")
    .select(PUESTOS_SELECT_FULL)
    .eq("municipio_id", municipioId)
    .order("nombre");
  if (!full.error) return full;
  return supabase
    .from("puestos")
    .select(PUESTOS_SELECT_BASE)
    .eq("municipio_id", municipioId)
    .order("nombre");
}

type PuestoJefaturaRow = {
  puesto_id: string;
  departamento_id: string;
};

async function listarPuestoJefaturas(supabase: SupabaseServerClient) {
  return supabase
    .from("puesto_jefaturas")
    .select("puesto_id, departamento_id");
}

function agruparJefaturasPorPuesto(
  rows: PuestoJefaturaRow[],
  departamentosPorId: Map<string, { nombre: string; activo: boolean }>,
) {
  const idsPorPuesto = new Map<string, string[]>();
  const nombresPorPuesto = new Map<string, string[]>();

  for (const row of rows) {
    const departamento = departamentosPorId.get(row.departamento_id);
    if (!departamento || !departamento.activo) continue;

    const ids = idsPorPuesto.get(row.puesto_id) ?? [];
    ids.push(row.departamento_id);
    idsPorPuesto.set(row.puesto_id, ids);

    const nombres = nombresPorPuesto.get(row.puesto_id) ?? [];
    nombres.push(departamento.nombre);
    nombresPorPuesto.set(row.puesto_id, nombres);
  }

  return { idsPorPuesto, nombresPorPuesto };
}

function departamentoPayload(values: DepartamentoFormValues, municipioId: number) {
  return {
    nombre: values.nombre,
    parent_id: values.parent_id,
    descripcion: values.descripcion?.trim() || null,
    comunidad_id: values.comunidad_id || null,
    jalar_jefes_territoriales: Boolean(values.jalar_jefes_territoriales),
    municipio_id: municipioId,
  };
}

async function insertarDepartamento(
  supabase: SupabaseServerClient,
  values: DepartamentoFormValues,
  municipioId: number,
) {
  let query = supabase
    .from("departamentos")
    .select("orden")
    .eq("municipio_id", municipioId);

  if (values.parent_id === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", values.parent_id);
  }

  const { data: ultimos } = await query
    .order("orden", { ascending: false })
    .limit(1);

  const maxOrden = ultimos && ultimos.length > 0 ? (ultimos[0].orden ?? 0) + 1 : 0;

  const payload = departamentoPayload(values, municipioId);
  const insertRes = await supabase.from("departamentos").insert({
    ...payload,
    orden: maxOrden,
  });

  if (!insertRes.error) return insertRes;

  // Fallback en caso de que la columna jalar_jefes_territoriales aún no exista en Supabase
  const { jalar_jefes_territoriales, ...legacyPayload } = payload;
  return supabase.from("departamentos").insert({
    ...legacyPayload,
    orden: maxOrden,
  });
}

async function actualizarDepartamento(
  supabase: SupabaseServerClient,
  id: string,
  values: DepartamentoFormValues,
  municipioId: number,
) {
  const payload = departamentoPayload(values, municipioId);
  const updateRes = await supabase
    .from("departamentos")
    .update(payload)
    .eq("id", id)
    .eq("municipio_id", municipioId);

  if (!updateRes.error) return updateRes;

  // Fallback en caso de que la columna jalar_jefes_territoriales aún no exista en Supabase
  const { jalar_jefes_territoriales, ...legacyPayload } = payload;
  return supabase
    .from("departamentos")
    .update(legacyPayload)
    .eq("id", id)
    .eq("municipio_id", municipioId);
}

type PostgrestErrorLike = { code?: string; message?: string };

function mapPuestoDbError(error: PostgrestErrorLike | null): string {
  if (!error) return "SAVE_FAILED";
  if (error.code === "42501") return "FORBIDDEN";
  if (
    error.code === "23502" &&
    error.message?.toLowerCase().includes("es_jefatura")
  ) {
    return "DROP_ES_JEFATURA";
  }
  if (error.code === "42P01") return "JEFATURAS_SYNC_FAILED";
  if (error.code === "42703") return "JEFATURAS_SYNC_FAILED";
  return "SAVE_FAILED";
}

async function insertarPuesto(
  supabase: SupabaseServerClient,
  values: PuestoFormValues,
  municipioId: number,
) {
  const payload = {
    nombre: values.nombre.trim(),
    departamento_id: values.departamento_id,
    municipio_id: municipioId,
    fecha: values.fecha ? new Date(values.fecha).toISOString() : null,
    activo: values.activo,
    acreditaciones: values.acreditaciones ?? [],
  };

  const withSelect = await supabase
    .from("puestos")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (!withSelect.error && withSelect.data?.id) {
    return { id: String(withSelect.data.id), error: null };
  }

  const plainInsert = await supabase.from("puestos").insert(payload);
  if (plainInsert.error) {
    return { id: null, error: plainInsert.error };
  }

  const fetched = await supabase
    .from("puestos")
    .select("id")
    .eq("departamento_id", payload.departamento_id)
    .eq("nombre", payload.nombre)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fetched.error && fetched.data?.id) {
    return { id: String(fetched.data.id), error: null };
  }

  return {
    id: null,
    error: withSelect.error ?? plainInsert.error ?? fetched.error,
  };
}

async function actualizarPuesto(
  supabase: SupabaseServerClient,
  id: string,
  values: PuestoFormValues,
  municipioId: number,
) {
  const base = await supabase
    .from("puestos")
    .update({
      nombre: values.nombre,
      departamento_id: values.departamento_id,
      fecha: values.fecha ? new Date(values.fecha).toISOString() : null,
      activo: values.activo,
    })
    .eq("id", id)
    .eq("municipio_id", municipioId);

  if (!base.error) return base;

  return supabase
    .from("puestos")
    .update({
      nombre: values.nombre,
      departamento_id: values.departamento_id,
      orden: values.orden,
      fecha: values.fecha ? new Date(values.fecha).toISOString() : null,
      activo: values.activo,
    })
    .eq("id", id)
    .eq("municipio_id", municipioId);
}

async function sincronizarPuestoJefaturas(
  supabase: SupabaseServerClient,
  puestoId: string,
  jefaturaIds: string[],
  mode: "create" | "update" = "update",
) {
  if (jefaturaIds.length === 0) {
    if (mode === "update") {
      const { error } = await supabase
        .from("puesto_jefaturas")
        .delete()
        .eq("puesto_id", puestoId);
      return error;
    }
    return null;
  }

  if (mode === "update") {
    const { error: deleteError } = await supabase
      .from("puesto_jefaturas")
      .delete()
      .eq("puesto_id", puestoId);

    if (deleteError) return deleteError;
  }

  const { error: insertError } = await supabase.from("puesto_jefaturas").insert(
    jefaturaIds.map((departamentoId) => ({
      puesto_id: puestoId,
      departamento_id: departamentoId,
    })),
  );

  return insertError;
}

function construirArbol(
  departamentos: DepartamentoRecord[],
  puestos: PuestoRecord[],
  titularesPorPuesto: Map<string, { id: string; nombre: string }>,
): NodoOrganizacion {
  const departamentosPorId = new Map(departamentos.map((d) => [d.id, d]));

  const hijosPorPadre = new Map<string | null, DepartamentoRecord[]>();
  for (const dep of departamentos) {
    const lista = hijosPorPadre.get(dep.parent_id) ?? [];
    lista.push(dep);
    hijosPorPadre.set(dep.parent_id, lista);
  }

  const puestosPorDepartamento = new Map<string, PuestoRecord[]>();
  for (const puesto of puestos) {
    if (!puesto.departamento_id) continue;
    const lista = puestosPorDepartamento.get(puesto.departamento_id) ?? [];
    lista.push(puesto);
    puestosPorDepartamento.set(puesto.departamento_id, lista);
  }

  const jefaturasValidasDe = (puesto: PuestoRecord): string[] =>
    puesto.jefatura_ids.filter((depId) => {
      const dep = departamentosPorId.get(depId);
      if (!dep) return false;
      return (
        depId === puesto.departamento_id ||
        dep.parent_id === puesto.departamento_id
      );
    });

  const ordenarDepartamentos = (lista: DepartamentoRecord[]) =>
    [...lista].sort(
      (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre),
    );

  const ordenarPuestos = (lista: PuestoRecord[]) =>
    [...lista].sort(
      (a, b) =>
        jefaturasValidasDe(b).length - jefaturasValidasDe(a).length ||
        a.orden - b.orden ||
        a.nombre.localeCompare(b.nombre),
    );

  const construirPuesto = (puesto: PuestoRecord): NodoOrganizacion => {
    const titular = titularesPorPuesto.get(puesto.id);
    return {
      id: puesto.id,
      nombre: puesto.nombre,
      tipo: "unidad",
      tiene_jefaturas: jefaturasValidasDe(puesto).length > 0,
      titular: titular?.nombre,
      titular_id: titular?.id,
      fecha: puesto.fecha,
      activo: puesto.activo,
      acreditaciones: puesto.acreditaciones,
    };
  };

  const construirDepartamento = (dep: DepartamentoRecord): NodoOrganizacion => {
    const subDepartamentosOrdenados = ordenarDepartamentos(
      hijosPorPadre.get(dep.id) ?? [],
    );
    const subDepartamentoNodos = new Map(
      subDepartamentosOrdenados.map((sd) => [sd.id, construirDepartamento(sd)]),
    );

    const puestosEnDep = ordenarPuestos(
      puestosPorDepartamento.get(dep.id) ?? [],
    );
    const puestosJefe = puestosEnDep.filter(
      (p) => jefaturasValidasDe(p).length > 0,
    );
    const puestosEquipo = puestosEnDep.filter(
      (p) => jefaturasValidasDe(p).length === 0,
    );

    const jefePrincipal = puestosJefe[0];
    const dependenciasAsignadas = new Set<string>();

    const nodosJefe = puestosJefe.map((jefe) => {
      const nodo = construirPuesto(jefe);
      const dependenciasDelJefe = jefaturasValidasDe(jefe)
        .filter((depId) => subDepartamentoNodos.has(depId))
        .map((depId) => {
          dependenciasAsignadas.add(depId);
          return subDepartamentoNodos.get(depId) as NodoOrganizacion;
        });
      const equipo =
        jefe.id === jefePrincipal?.id
          ? puestosEquipo.map(construirPuesto)
          : [];
      const hijos = [...equipo, ...dependenciasDelJefe];
      return hijos.length > 0 ? { ...nodo, hijos } : nodo;
    });

    const nodosPuesto = puestosJefe.length
      ? nodosJefe
      : puestosEquipo.map(construirPuesto);

    const subDepartamentosSueltos = subDepartamentosOrdenados
      .filter((sd) => !dependenciasAsignadas.has(sd.id))
      .map((sd) => subDepartamentoNodos.get(sd.id) as NodoOrganizacion);

    return {
      id: dep.id,
      nombre: dep.nombre,
      tipo: "nivel",
      descripcion: dep.descripcion ?? undefined,
      hijos: [...nodosPuesto, ...subDepartamentosSueltos],
    };
  };

  const raices = ordenarDepartamentos(hijosPorPadre.get(null) ?? []).map(
    construirDepartamento,
  );

  return { ...ESTRUCTURA_VACIA, hijos: raices };
}

async function cargarPuestosConJefaturas(
  supabase: SupabaseServerClient,
  municipioId: number,
  departamentosDataPreloaded?: Record<string, unknown>[],
): Promise<PuestoRecord[]> {
  const [puestosRes, asignacionesRes, departamentosRes] = await Promise.all([
    listarPuestos(supabase, municipioId),
    listarPuestoJefaturas(supabase),
    departamentosDataPreloaded
      ? Promise.resolve({ data: departamentosDataPreloaded, error: null })
      : listarDepartamentos(supabase, municipioId),
  ]);

  if (puestosRes.error) return [];

  const departamentosPorId = new Map(
    (departamentosRes.data ?? []).map((row) => {
      const dep = normalizarDepartamento(row as Record<string, unknown>);
      return [dep.id, { nombre: dep.nombre, activo: dep.activo }];
    }),
  );

  const puestosRows = (puestosRes.data ?? []).map((row) =>
    normalizarPuesto(row as Record<string, unknown>, [], []),
  );

  const asignaciones = asignacionesRes.error
    ? []
    : ((asignacionesRes.data ?? []) as PuestoJefaturaRow[]);
  const { idsPorPuesto, nombresPorPuesto } = agruparJefaturasPorPuesto(
    asignaciones,
    departamentosPorId,
  );

  return puestosRows.map((puesto) =>
    normalizarPuesto(
      {
        id: puesto.id,
        nombre: puesto.nombre,
        departamento_id: puesto.departamento_id,
        orden: puesto.orden,
        activo: puesto.activo,
        fecha: puesto.fecha,
        acreditaciones: puesto.acreditaciones,
      },
      idsPorPuesto.get(puesto.id) ?? [],
      nombresPorPuesto.get(puesto.id) ?? [],
    ),
  );
}

type ProfileTitularRow = {
  id: string;
  nombre: string;
  email?: string | null;
  puesto_id: string | null;
};

async function listarProfilesActivos(supabase: SupabaseServerClient, municipioId: number) {
  const withEmail = await supabase
    .from("profiles")
    .select("id, nombre, email, puesto_id, activo")
    .eq("activo", true)
    .eq("municipio_id", municipioId)
    .order("nombre");
  if (!withEmail.error) return withEmail;

  return supabase
    .from("profiles")
    .select("id, nombre, puesto_id, activo")
    .eq("activo", true)
    .eq("municipio_id", municipioId)
    .order("nombre");
}

async function listarTitularesPorPuesto(
  supabase: SupabaseServerClient,
  municipioId: number,
): Promise<Map<string, { id: string; nombre: string }>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, puesto_id")
    .eq("municipio_id", municipioId)
    .not("puesto_id", "is", null);

  const map = new Map<string, { id: string; nombre: string }>();
  if (error) return map;

  for (const row of data ?? []) {
    const puestoId = row.puesto_id as string | null;
    if (!puestoId) continue;
    map.set(puestoId, {
      id: String(row.id),
      nombre: String(row.nombre ?? ""),
    });
  }

  return map;
}

export async function getPersonasParaAsignar(puestoId: string): Promise<{
  personas: ProfileOpcion[];
  titularActualId: string | null;
  error: string | null;
}> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) {
      return { personas: [], titularActualId: null, error };
    }

    const [profilesRes, puestos] = await Promise.all([
      listarProfilesActivos(supabase, municipioId),
      cargarPuestosConJefaturas(supabase, municipioId),
    ]);

    if (profilesRes.error) {
      return { personas: [], titularActualId: null, error: "LOAD_PROFILES_FAILED" };
    }

    const puestosPorId = new Map(puestos.map((p) => [p.id, p.nombre]));
    const personas = (profilesRes.data ?? []).map((row) => {
      const profile = row as ProfileTitularRow;
      const assignedPuestoId = profile.puesto_id;
      return {
        id: String(profile.id),
        nombre: String(profile.nombre ?? ""),
        email: profile.email ?? null,
        puesto_id: assignedPuestoId,
        puesto_nombre: assignedPuestoId
          ? (puestosPorId.get(assignedPuestoId) ?? null)
          : null,
      };
    });

    const titularActualId =
      personas.find((p) => p.puesto_id === puestoId)?.id ?? null;

    return { personas, titularActualId, error: null };
  } catch {
    return { personas: [], titularActualId: null, error: "LOAD_PROFILES_FAILED" };
  }
}

export async function asignarPersonaAPuesto(
  values: AsignarPersonaValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const parsed = asignarPersonaSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { puesto_id: puestoId, profile_id: profileId } = parsed.data;

    const { error: clearPuestoError } = await supabase
      .from("profiles")
      .update({ puesto_id: null })
      .eq("puesto_id", puestoId);

    if (clearPuestoError) return { success: false, error: "ASSIGN_FAILED" };

    if (!profileId) {
      return { success: true, error: null };
    }

    const { error: clearProfileError } = await supabase
      .from("profiles")
      .update({ puesto_id: null })
      .eq("id", profileId);

    if (clearProfileError) return { success: false, error: "ASSIGN_FAILED" };

    const { error: assignError } = await supabase
      .from("profiles")
      .update({ puesto_id: puestoId })
      .eq("id", profileId);

    if (assignError) return { success: false, error: "ASSIGN_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "ASSIGN_FAILED" };
  }
}

export async function getEstructuraOrganizacional(): Promise<{
  data: NodoOrganizacion | null;
  error: string | null;
}> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) {
      return { data: null, error };
    }

    // 1. Cargar departamentos primero para reutilizarlos en cargarPuestosConJefaturas
    const [departamentosRes, titularesPorPuesto] = await Promise.all([
      listarDepartamentos(supabase, municipioId),
      listarTitularesPorPuesto(supabase, municipioId),
    ]);

    if (departamentosRes.error) {
      return { data: ESTRUCTURA_VACIA, error: "LOAD_FAILED" };
    }

    const rawDeptos = (departamentosRes.data ?? []) as Record<string, unknown>[];

    // 2. Cargar puestos reutilizando los departamentos ya obtenidos
    const puestos = await cargarPuestosConJefaturas(
      supabase,
      municipioId,
      rawDeptos,
    );

    const departamentos = rawDeptos.map((row) =>
      normalizarDepartamento(row),
    );

    // Separar los departamentos normales de los creados automáticamente por comunidades territoriales
    const deptosAdministrativos = departamentos.filter((d) => {
      if (d.comunidad_id && String(d.comunidad_id).trim() !== "") {
        return false;
      }
      const nombreLower = d.nombre.trim().toLowerCase();
      if (
        nombreLower.startsWith("comunidad:") ||
        nombreLower.startsWith("cocode:") ||
        nombreLower.startsWith("consejo comunitario:")
      ) {
        return false;
      }
      return true;
    });

    const data = construirArbol(deptosAdministrativos, puestos, titularesPorPuesto);

    // Si algún departamento tiene jalar_jefes_territoriales activado, inyectar dinámicamente puestos líderes territoriales
    const depsConsolidadores = departamentos.filter((d) => d.jalar_jefes_territoriales);
    if (depsConsolidadores.length > 0 && data) {
      try {
        const [comunidadesRes, puestosTerritorialesRes, deptosTerritorialesRes] = await Promise.all([
          supabase
            .from("lug_comunidades")
            .select("id, nombre, tipo")
            .eq("municipio_id", municipioId),
          supabase
            .from("puestos")
            .select("id, nombre, departamento_id, activo, fecha, acreditaciones")
            .eq("municipio_id", municipioId)
            .not("departamento_id", "is", null),
          supabase
            .from("departamentos")
            .select("id, comunidad_id")
            .eq("municipio_id", municipioId)
            .not("comunidad_id", "is", null),
        ]);

        if (
          !comunidadesRes.error &&
          comunidadesRes.data &&
          !puestosTerritorialesRes.error &&
          puestosTerritorialesRes.data &&
          !deptosTerritorialesRes.error &&
          deptosTerritorialesRes.data
        ) {
          const comunidadesMap = new Map(comunidadesRes.data.map((c) => [c.id, c]));
          const deptoToComunidadMap = new Map(
            deptosTerritorialesRes.data.map((d) => [d.id, d.comunidad_id])
          );

          // Obtener jefaturas de puestos territoriales
          const puestoIdsTerritoriales = puestosTerritorialesRes.data.map((p) => p.id);
          if (puestoIdsTerritoriales.length > 0) {
            const { data: jefaturasTerr } = await supabase
              .from("puesto_jefaturas")
              .select("puesto_id, departamento_id")
              .in("puesto_id", puestoIdsTerritoriales);

            const jefesPuestoIds = new Set((jefaturasTerr ?? []).map((j) => j.puesto_id));
            const puestosLideres = puestosTerritorialesRes.data.filter((p) =>
              p.departamento_id && deptoToComunidadMap.has(p.departamento_id) && jefesPuestoIds.has(p.id)
            );

            if (puestosLideres.length > 0) {
              const nodosLideres: NodoOrganizacion[] = puestosLideres.map((p) => {
                const comId = deptoToComunidadMap.get(p.departamento_id!);
                const comunidad = comId ? comunidadesMap.get(comId) : null;
                const titular = titularesPorPuesto.get(p.id);
                let acreditaciones: AcreditacionFile[] = [];
                if (Array.isArray(p.acreditaciones)) {
                  acreditaciones = p.acreditaciones as AcreditacionFile[];
                } else if (typeof p.acreditaciones === "string") {
                  try { acreditaciones = JSON.parse(p.acreditaciones); } catch {}
                }

                return {
                  id: p.id,
                  nombre: comunidad ? `${p.nombre} - ${comunidad.nombre}` : p.nombre,
                  tipo: "unidad",
                  tiene_jefaturas: true,
                  titular: titular?.nombre,
                  titular_id: titular?.id,
                  fecha: p.fecha ? String(p.fecha).split("T")[0] : null,
                  activo: p.activo !== false,
                  acreditaciones,
                };
              });

              // Inyectar en los nodos correspondientes
              for (const depConsolidador of depsConsolidadores) {
                const buscarYInyectar = (nodo: NodoOrganizacion): boolean => {
                  if (nodo.id === depConsolidador.id) {
                    nodo.hijos = [...(nodo.hijos ?? []), ...nodosLideres];
                    return true;
                  }
                  for (const hijo of nodo.hijos ?? []) {
                    if (buscarYInyectar(hijo)) return true;
                  }
                  return false;
                };
                buscarYInyectar(data);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error al inyectar líderes territoriales:", err);
      }
    }

    return { data, error: null };
  } catch {
    return { data: ESTRUCTURA_VACIA, error: null };
  }
}

export async function getDepartamentos(): Promise<DepartamentoRecord[]> {
  const { supabase, municipioId, error } = await requireAdminConMunicipio();
  if (error || !supabase) return [];

  const { data, error: queryError } = await listarDepartamentos(supabase, municipioId);

  if (queryError) return [];
  return (data ?? []).map((row) =>
    normalizarDepartamento(row as Record<string, unknown>),
  );
}

export async function getPuestos(): Promise<PuestoRecord[]> {
  const { supabase, municipioId, error } = await requireAdminConMunicipio();
  if (error || !supabase) return [];

  return cargarPuestosConJefaturas(supabase, municipioId);
}

function generaCiclo(
  departamentos: { id: string; parent_id: string | null }[],
  id: string,
  nuevoPadre: string | null,
): boolean {
  if (!nuevoPadre) return false;
  if (nuevoPadre === id) return true;

  const hijosPorPadre = new Map<string | null, string[]>();
  for (const dep of departamentos) {
    const lista = hijosPorPadre.get(dep.parent_id) ?? [];
    lista.push(dep.id);
    hijosPorPadre.set(dep.parent_id, lista);
  }

  const descendientes = new Set<string>();
  const pila = [...(hijosPorPadre.get(id) ?? [])];
  while (pila.length > 0) {
    const actual = pila.pop()!;
    if (descendientes.has(actual)) continue;
    descendientes.add(actual);
    pila.push(...(hijosPorPadre.get(actual) ?? []));
  }

  return descendientes.has(nuevoPadre);
}

export async function createDepartamento(
  values: DepartamentoFormValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const parsed = departamentoFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { error: insertError } = await insertarDepartamento(
      supabase,
      parsed.data,
      municipioId,
    );

    if (insertError) return { success: false, error: "SAVE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function updateDepartamento(
  id: string,
  values: DepartamentoFormValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const parsed = departamentoFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { data: existentes, error: fetchError } = await supabase
      .from("departamentos")
      .select("id, parent_id")
      .eq("municipio_id", municipioId);

    if (fetchError) return { success: false, error: "SAVE_FAILED" };

    if (
      generaCiclo(
        (existentes ?? []) as { id: string; parent_id: string | null }[],
        id,
        parsed.data.parent_id,
      )
    ) {
      return { success: false, error: "CYCLE" };
    }

    const { error: updateError } = await actualizarDepartamento(
      supabase,
      id,
      parsed.data,
      municipioId,
    );

    if (updateError) return { success: false, error: "SAVE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function deleteDepartamento(id: string): Promise<ActionResult> {
  try {
    const { supabase, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const [{ count: subDepartamentos }, { count: puestos }] = await Promise.all([
      supabase
        .from("departamentos")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", id),
      supabase
        .from("puestos")
        .select("id", { count: "exact", head: true })
        .eq("departamento_id", id),
    ]);

    if ((subDepartamentos ?? 0) > 0 || (puestos ?? 0) > 0) {
      return { success: false, error: "HAS_CHILDREN" };
    }

    const { error: deleteError } = await supabase
      .from("departamentos")
      .delete()
      .eq("id", id);

    if (deleteError) return { success: false, error: "DELETE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "DELETE_FAILED" };
  }
}

export async function getComunidadesTerritoriales(): Promise<{ id: string; nombre: string; tipo: string }[]> {
  const { supabase, municipioId, error } = await requireAdminConMunicipio();
  if (error || !supabase) return [];
  const { data } = await supabase
    .from("lug_comunidades")
    .select("id, nombre, tipo")
    .eq("municipio_id", municipioId)
    .order("nombre");
  return data ?? [];
}

function validarCreacionPuesto(
  puestos: PuestoRecord[],
  departamentoId: string,
  jefaturaIds: string[],
): string | null {
  const enDep = puestos.filter((p) => p.departamento_id === departamentoId);
  const tieneJefe = enDep.some((p) => p.jefatura_ids.length > 0);

  if (jefaturaIds.length > 0) return null;
  if (!tieneJefe) {
    return enDep.length === 0 ? "FIRST_PUESTO_JEFE_REQUIRED" : "JEFE_REQUIRED";
  }
  return null;
}

function validarSalidaPuesto(
  puestos: PuestoRecord[],
  puesto: PuestoRecord,
): string | null {
  if (!puesto.departamento_id) return null;

  const enDep = puestos.filter(
    (p) => p.departamento_id === puesto.departamento_id && p.id !== puesto.id,
  );
  if (enDep.length === 0) return null;

  const esJefe = puesto.jefatura_ids.length > 0;
  if (!esJefe) return null;

  const otrosJefes = enDep.filter((p) => p.jefatura_ids.length > 0);
  const equipoSinJefatura = enDep.some((p) => p.jefatura_ids.length === 0);

  if (equipoSinJefatura && otrosJefes.length === 0) {
    return "JEFE_REQUIRED_LEAVE";
  }

  return null;
}

function validarLlegadaPuesto(
  puestos: PuestoRecord[],
  puesto: PuestoRecord,
  nuevoDepartamentoId: string,
): string | null {
  const enDestino = puestos.filter(
    (p) =>
      p.departamento_id === nuevoDepartamentoId && p.id !== puesto.id,
  );
  const tieneJefe = enDestino.some((p) => p.jefatura_ids.length > 0);

  if (puesto.jefatura_ids.length > 0) return null;
  if (!tieneJefe) {
    return enDestino.length === 0 ? "FIRST_PUESTO_JEFE_REQUIRED" : "JEFE_REQUIRED";
  }
  return null;
}

export async function createPuesto(
  values: PuestoFormValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const parsed = puestoFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const departamentosRes = await listarDepartamentos(supabase, municipioId);
    const departamentos = departamentosRes.error
      ? []
      : (departamentosRes.data ?? []).map((row) =>
          normalizarDepartamento(row as Record<string, unknown>),
        );

    const jefaturaIds = jefaturasPermitidas(
      departamentos,
      parsed.data.departamento_id,
      parsed.data.jefatura_ids,
    );

    const puestos = await cargarPuestosConJefaturas(supabase, municipioId);
    const reglaError = validarCreacionPuesto(
      puestos,
      parsed.data.departamento_id,
      jefaturaIds,
    );
    if (reglaError) return { success: false, error: reglaError };

    const insertRes = await insertarPuesto(
      supabase,
      {
        ...parsed.data,
        jefatura_ids: jefaturaIds,
      },
      municipioId,
    );

    if (!insertRes.id) {
      return {
        success: false,
        error: mapPuestoDbError(insertRes.error as PostgrestErrorLike | null),
      };
    }

    const syncError = await sincronizarPuestoJefaturas(
      supabase,
      insertRes.id,
      jefaturaIds,
      "create",
    );

    if (syncError) {
      await supabase.from("puestos").delete().eq("id", insertRes.id);
      return {
        success: false,
        error: mapPuestoDbError(syncError as PostgrestErrorLike),
      };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function updatePuesto(
  id: string,
  values: PuestoFormValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const parsed = puestoFormSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const departamentosRes = await listarDepartamentos(supabase, municipioId);
    const departamentos = departamentosRes.error
      ? []
      : (departamentosRes.data ?? []).map((row) =>
          normalizarDepartamento(row as Record<string, unknown>),
        );

    const jefaturaIds = jefaturasPermitidas(
      departamentos,
      parsed.data.departamento_id,
      parsed.data.jefatura_ids,
    );

    const { error: updateError } = await actualizarPuesto(
      supabase,
      id,
      parsed.data,
      municipioId,
    );

    if (updateError) return { success: false, error: "SAVE_FAILED" };

    const syncError = await sincronizarPuestoJefaturas(
      supabase,
      id,
      jefaturaIds,
      "update",
    );

    if (syncError) {
      return {
        success: false,
        error: mapPuestoDbError(syncError as PostgrestErrorLike),
      };
    }
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function reubicarPuesto(
  values: ReubicarPuestoValues,
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const parsed = reubicarPuestoSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { puesto_id: puestoId, departamento_id: nuevoDepartamentoId } =
      parsed.data;

    const [departamentosRes, puestos, titularesPorPuesto] = await Promise.all([
      listarDepartamentos(supabase, municipioId),
      cargarPuestosConJefaturas(supabase, municipioId),
      listarTitularesPorPuesto(supabase, municipioId),
    ]);

    const puesto = puestos.find((p) => p.id === puestoId);
    if (!puesto) return { success: false, error: "PUESTO_NOT_FOUND" };

    if (puesto.departamento_id === nuevoDepartamentoId) {
      return { success: false, error: "SAME_DEPARTMENT" };
    }

    const departamentos = departamentosRes.error
      ? []
      : (departamentosRes.data ?? []).map((row) =>
          normalizarDepartamento(row as Record<string, unknown>),
        );

    const destino = departamentos.find((d) => d.id === nuevoDepartamentoId);
    if (!destino?.activo) {
      return { success: false, error: "INVALID_INPUT" };
    }

    if (departamentos.length > 0) {
      const arbol = construirArbol(departamentos, puestos, titularesPorPuesto);
      const nodo = buscarNodoPorId(arbol, puestoId);
      if (nodo && (nodo.hijos?.length ?? 0) > 0) {
        return { success: false, error: "PUESTO_HAS_CHILDREN" };
      }
    }

    const salidaError = validarSalidaPuesto(puestos, puesto);
    if (salidaError) return { success: false, error: salidaError };

    const llegadaError = validarLlegadaPuesto(
      puestos,
      puesto,
      nuevoDepartamentoId,
    );
    if (llegadaError) return { success: false, error: llegadaError };

    const { error: updateError } = await supabase
      .from("puestos")
      .update({ departamento_id: nuevoDepartamentoId })
      .eq("id", puestoId);

    if (updateError) return { success: false, error: "SAVE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function deletePuesto(id: string): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const [departamentosRes, puestos, titularesPorPuesto] = await Promise.all([
      listarDepartamentos(supabase, municipioId),
      cargarPuestosConJefaturas(supabase, municipioId),
      listarTitularesPorPuesto(supabase, municipioId),
    ]);

    const puestoTarget = puestos.find((p) => p.id === id);
    if (!puestoTarget) return { success: false, error: "PUESTO_NOT_FOUND" };

    if (!departamentosRes.error) {
      const departamentos = (departamentosRes.data ?? []).map((row) =>
        normalizarDepartamento(row as Record<string, unknown>),
      );
      const arbol = construirArbol(departamentos, puestos, titularesPorPuesto);
      const nodo = buscarNodoPorId(arbol, id);
      if (nodo) {
        const tieneSubdeps = (nodo.hijos ?? []).some((h) => h.tipo === "nivel");
        if (tieneSubdeps) {
          return { success: false, error: "PUESTO_HAS_CHILDREN" };
        }
      }
    }

    const salidaError = validarSalidaPuesto(puestos, puestoTarget);
    if (salidaError) return { success: false, error: salidaError };

    // Limpiar asociaciones FK
    await supabase.from("puesto_jefaturas").delete().eq("puesto_id", id);
    await supabase
      .from("profiles")
      .update({ puesto_id: null })
      .eq("puesto_id", id);

    const { error: deleteError } = await supabase
      .from("puestos")
      .delete()
      .eq("id", id);

    if (deleteError) return { success: false, error: "DELETE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "DELETE_FAILED" };
  }
}

export async function moverDepartamento(
  id: string,
  direccion: "arriba" | "abajo" | "inicio" | "fin",
): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const { data: targetDep, error: targetErr } = await supabase
      .from("departamentos")
      .select("id, parent_id, orden")
      .eq("id", id)
      .eq("municipio_id", municipioId)
      .maybeSingle();

    if (targetErr || !targetDep) {
      return { success: false, error: "DEPARTMENT_NOT_FOUND" };
    }

    const parentId = targetDep.parent_id;

    let query = supabase
      .from("departamentos")
      .select("id, orden, nombre")
      .eq("municipio_id", municipioId);

    if (parentId === null) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", parentId);
    }

    const { data: hermanos, error: hermanosErr } = await query
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (hermanosErr || !hermanos || hermanos.length <= 1) {
      return { success: true, error: null };
    }

    const idx = hermanos.findIndex((h) => h.id === id);
    if (idx === -1) {
      return { success: false, error: "DEPARTMENT_NOT_FOUND" };
    }

    const list = [...hermanos];

    if (direccion === "arriba") {
      if (idx === 0) return { success: true, error: null };
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
    } else if (direccion === "abajo") {
      if (idx === list.length - 1) return { success: true, error: null };
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
    } else if (direccion === "inicio") {
      if (idx === 0) return { success: true, error: null };
      const item = list.splice(idx, 1)[0];
      list.unshift(item);
    } else if (direccion === "fin") {
      if (idx === list.length - 1) return { success: true, error: null };
      const item = list.splice(idx, 1)[0];
      list.push(item);
    }

    const updates = list.map((item, index) =>
      supabase
        .from("departamentos")
        .update({ orden: index })
        .eq("id", item.id)
        .eq("municipio_id", municipioId),
    );

    await Promise.all(updates);

    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function agregarAcreditacionPuesto({
  puestoId,
  nombre,
  filePath,
}: {
  puestoId: string;
  nombre: string;
  filePath: string;
}): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const { data: puesto, error: fetchErr } = await supabase
      .from("puestos")
      .select("acreditaciones")
      .eq("id", puestoId)
      .eq("municipio_id", municipioId)
      .maybeSingle();

    if (fetchErr || !puesto) {
      return { success: false, error: "PUESTO_NOT_FOUND" };
    }

    let lista: AcreditacionFile[] = [];
    if (Array.isArray(puesto.acreditaciones)) {
      lista = puesto.acreditaciones as AcreditacionFile[];
    } else if (typeof puesto.acreditaciones === "string") {
      try {
        lista = JSON.parse(puesto.acreditaciones);
      } catch {
        lista = [];
      }
    }

    const nuevoArchivo: AcreditacionFile = {
      id: String(Date.now()),
      nombre,
      file_path: filePath,
      created_at: new Date().toISOString(),
    };

    lista = [nuevoArchivo, ...lista];

    const { error: updateErr } = await supabase
      .from("puestos")
      .update({ acreditaciones: lista })
      .eq("id", puestoId)
      .eq("municipio_id", municipioId);

    if (updateErr) return { success: false, error: "SAVE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "SAVE_FAILED" };
  }
}

export async function eliminarAcreditacionPuesto({
  puestoId,
  archivoId,
}: {
  puestoId: string;
  archivoId: string;
}): Promise<ActionResult> {
  try {
    const { supabase, municipioId, error } = await requireAdminConMunicipio();
    if (error || !supabase) return { success: false, error };

    const { data: puesto, error: fetchErr } = await supabase
      .from("puestos")
      .select("acreditaciones")
      .eq("id", puestoId)
      .eq("municipio_id", municipioId)
      .maybeSingle();

    if (fetchErr || !puesto) {
      return { success: false, error: "PUESTO_NOT_FOUND" };
    }

    let lista: AcreditacionFile[] = [];
    if (Array.isArray(puesto.acreditaciones)) {
      lista = puesto.acreditaciones as AcreditacionFile[];
    } else if (typeof puesto.acreditaciones === "string") {
      try {
        lista = JSON.parse(puesto.acreditaciones);
      } catch {
        lista = [];
      }
    }

    const filtrado = lista.filter((a) => a.id !== archivoId);

    const { error: updateErr } = await supabase
      .from("puestos")
      .update({ acreditaciones: filtrado })
      .eq("id", puestoId)
      .eq("municipio_id", municipioId);

    if (updateErr) return { success: false, error: "DELETE_FAILED" };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "DELETE_FAILED" };
  }
}
