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

export async function listarIntegrantesPorAño(
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
    };

    if (!agrupados[asig.id_comision]) {
      agrupados[asig.id_comision] = [];
    }
    agrupados[asig.id_comision].push(item);
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

  const { error } = await auth.supabase.from("comision_integrantes").insert({
    id_comision: comisionId,
    id_integrante: parseRes.data.id_integrante,
    año: parseRes.data.año,
  });

  if (error) return { success: false, error: error.message };

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
