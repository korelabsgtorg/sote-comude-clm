"use server";

import { createClient } from "@/utils/supabase/server";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";
import {
  comisionSchema,
  asignarIntegranteSchema,
  type ComisionFormValues,
  type ComisionRecord,
  type ComisionIntegranteRecord,
  type PersonaElegible,
  type AsignarIntegranteValues,
  type PlanTrabajoRecord,
} from "./zod";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const COMISIONES_LEY_DEFAULT = [
  "Educación, educación bilingüe intercultural, cultura y deportes",
  "Salud y asistencia social",
  "Servicios, infraestructura, ordenamiento territorial, urbanismo y vivienda",
  "Fomento económico, turismo, ambiente y recursos naturales",
  "Descentralización, fortalecimiento municipal y participación ciudadana",
  "De finanzas",
  "De probidad",
  "De los derechos humanos y de la paz",
  "De la familia, la mujer, la niñez, la juventud, adulto mayor o cualquier otra formada por proyección social",
];

async function requireAdminConMunicipio(): Promise<
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

export async function listarComisiones(): Promise<{
  data: ComisionRecord[] | null;
  error: string | null;
}> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { data: null, error: auth.error };

  const { data: comisionesExistentes, error } = await auth.supabase
    .from("comisiones")
    .select("*")
    .eq("municipio_id", auth.municipioId)
    .order("orden", { ascending: true, nullsFirst: false });

  if (error) return { data: null, error: error.message };

  return { data: (comisionesExistentes ?? []) as ComisionRecord[], error: null };
}

export async function crearComision(
  values: ComisionFormValues,
): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { success: false, error: auth.error };

  const parseRes = comisionSchema.safeParse(values);
  if (!parseRes.success) {
    return { success: false, error: parseRes.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { data: comisionesExistentes } = await auth.supabase
    .from("comisiones")
    .select("orden")
    .eq("municipio_id", auth.municipioId)
    .order("orden", { ascending: false })
    .limit(1);

  const ultimoOrden = comisionesExistentes?.[0]?.orden ?? -1;
  const nuevoOrden = Number(ultimoOrden) + 1;

  const { error } = await auth.supabase.from("comisiones").insert({
    municipio_id: auth.municipioId,
    nombre: parseRes.data.nombre,
    descripcion: parseRes.data.descripcion ?? null,
    activo: true,
    orden: nuevoOrden,
  });

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

export async function editarComision(
  id: string,
  values: ComisionFormValues,
): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { success: false, error: auth.error };

  const parseRes = comisionSchema.safeParse(values);
  if (!parseRes.success) {
    return { success: false, error: parseRes.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await auth.supabase
    .from("comisiones")
    .update({
      nombre: parseRes.data.nombre,
      descripcion: parseRes.data.descripcion ?? null,
    })
    .eq("id", id)
    .eq("municipio_id", auth.municipioId);

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

export async function alternarEstadoComision(
  id: string,
  nuevoEstado: boolean,
): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("comisiones")
    .update({ activo: nuevoEstado })
    .eq("id", id)
    .eq("municipio_id", auth.municipioId);

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

export async function listarIntegrantesPorAnio(
  año: number,
): Promise<{
  data: Record<string, ComisionIntegranteRecord[]> | null;
  error: string | null;
}> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { data: null, error: auth.error };

  const resAsignaciones = await auth.supabase
    .from("comision_integrantes")
    .select("*")
    .eq("año", año);

  if (resAsignaciones.error) return { data: null, error: resAsignaciones.error.message };
  const asignaciones = (resAsignaciones.data ?? []) as ComisionIntegranteRecord[];
  if (asignaciones.length === 0) return { data: {}, error: null };

  const userIds = Array.from(new Set(asignaciones.map((a) => a.id_integrante)));

  const { data: profiles, error: profileError } = await auth.supabase
    .from("profiles")
    .select("id, nombre, dpi, rol")
    .in("id", userIds);

  if (profileError) return { data: null, error: profileError.message };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const agrupados: Record<string, ComisionIntegranteRecord[]> = {};

  for (const asig of asignaciones) {
    const prof = profileMap.get(asig.id_integrante);
    const item: ComisionIntegranteRecord = {
      id: asig.id,
      id_comision: asig.id_comision,
      id_integrante: asig.id_integrante,
      año: asig.año,
      created_at: asig.created_at,
      nombre: prof?.nombre ?? "Usuario no encontrado",
      dpi: prof?.dpi,
      rol: prof?.rol,
      es_coordinador: Boolean(asig.es_coordinador),
    };

    if (!agrupados[asig.id_comision]) {
      agrupados[asig.id_comision] = [];
    }
    agrupados[asig.id_comision].push(item);
  }

  // Ordenar integrantes: el coordinador siempre primero, luego alfabéticamente
  for (const comId in agrupados) {
    agrupados[comId].sort((a, b) => {
      if (a.es_coordinador && !b.es_coordinador) return -1;
      if (!a.es_coordinador && b.es_coordinador) return 1;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });
  }

  return { data: agrupados, error: null };
}

export async function asignarIntegrante(
  comisionId: string,
  values: AsignarIntegranteValues,
): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { success: false, error: auth.error };

  const parseRes = asignarIntegranteSchema.safeParse(values);
  if (!parseRes.success) {
    return { success: false, error: parseRes.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { data: existente } = await auth.supabase
    .from("comision_integrantes")
    .select("id")
    .eq("id_comision", comisionId)
    .eq("id_integrante", parseRes.data.id_integrante)
    .eq("año", parseRes.data.año)
    .maybeSingle();

  if (existente) {
    return { success: false, error: "La persona ya pertenece a esta comisión en el año seleccionado" };
  }

  // Chequear si ya hay integrantes en esta comisión para este año
  const { count } = await auth.supabase
    .from("comision_integrantes")
    .select("id", { count: "exact", head: true })
    .eq("id_comision", comisionId)
    .eq("año", parseRes.data.año);

  const esPrimerIntegrante = (count ?? 0) === 0;
  const esCoordinador = parseRes.data.es_coordinador ?? esPrimerIntegrante;

  if (esCoordinador) {
    // Si este integrante se designa como coordinador, desmarcar a cualquier otro
    await auth.supabase
      .from("comision_integrantes")
      .update({ es_coordinador: false })
      .eq("id_comision", comisionId)
      .eq("año", parseRes.data.año);
  }

  const { error } = await auth.supabase.from("comision_integrantes").insert({
    id_comision: comisionId,
    id_integrante: parseRes.data.id_integrante,
    año: parseRes.data.año,
    es_coordinador: esCoordinador,
  });

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

export async function cambiarCoordinadorComision(params: {
  comisionId: string;
  año: number;
  nuevoCoordinadorIntegranteId: string;
}): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { success: false, error: auth.error };

  const { comisionId, año, nuevoCoordinadorIntegranteId } = params;

  // 1. Desmarcar cualquier coordinador actual en esta comisión y año
  const { error: errReset } = await auth.supabase
    .from("comision_integrantes")
    .update({ es_coordinador: false })
    .eq("id_comision", comisionId)
    .eq("año", año);

  if (errReset) return { success: false, error: errReset.message };

  // 2. Marcar al nuevo integrante como coordinador
  const { error: errSet } = await auth.supabase
    .from("comision_integrantes")
    .update({ es_coordinador: true })
    .eq("id_comision", comisionId)
    .eq("id_integrante", nuevoCoordinadorIntegranteId)
    .eq("año", año);

  if (errSet) return { success: false, error: errSet.message };

  return { success: true, error: null };
}

export async function eliminarIntegrante(
  idAsignacion: string,
): Promise<{ success: boolean; error: string | null }> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("comision_integrantes")
    .delete()
    .eq("id", idAsignacion);

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

export async function listarPersonasElegibles(): Promise<{
  data: PersonaElegible[] | null;
  error: string | null;
}> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { data: null, error: auth.error };

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, nombre, dpi, rol")
    .eq("municipio_id", auth.municipioId)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) return { data: null, error: error.message };

  return { data: (data as PersonaElegible[]) ?? [], error: null };
}

export async function listarPlanesTrabajoPorAnio(
  año: number,
): Promise<{
  data: Record<string, PlanTrabajoRecord> | null;
  error: string | null;
}> {
  const auth = await requireAdminConMunicipio();
  if (auth.error || !auth.supabase) return { data: null, error: auth.error };

  const { data: comisionesMun, error: errCom } = await auth.supabase
    .from("comisiones")
    .select("id")
    .eq("municipio_id", auth.municipioId);

  if (errCom) return { data: null, error: errCom.message };

  const comisionIds = (comisionesMun ?? []).map((c) => c.id as string);
  if (comisionIds.length === 0) return { data: {}, error: null };

  const { data: planes, error: errPlanes } = await auth.supabase
    .from("comision_planes_trabajo")
    .select("*")
    .in("id_comision", comisionIds)
    .eq("año", año)
    .order("created_at", { ascending: false });

  if (errPlanes) return { data: null, error: errPlanes.message };
  if (!planes || planes.length === 0) return { data: {}, error: null };

  const uploaderIds = Array.from(
    new Set(
      planes
        .map((p) => p.subido_por as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profileMap = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await auth.supabase
      .from("profiles")
      .select("id, nombre")
      .in("id", uploaderIds);

    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, (p.nombre as string) ?? "Usuario");
    }
  }

  const mapa: Record<string, PlanTrabajoRecord> = {};
  for (const plan of planes) {
    const cId = plan.id_comision as string;
    if (!mapa[cId]) {
      mapa[cId] = {
        id: plan.id as string,
        id_comision: cId,
        año: plan.año as number,
        archivo_url: plan.archivo_url,
        subido_por: (plan.subido_por as string | null) ?? null,
        subido_por_nombre: plan.subido_por
          ? (profileMap.get(plan.subido_por as string) ?? null)
          : null,
        created_at: plan.created_at as string,
      };
    }
  }

  return { data: mapa, error: null };

}
