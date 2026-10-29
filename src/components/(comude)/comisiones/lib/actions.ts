"use server";

import { createClient } from "@/utils/supabase/server";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";
import {
  BUCKET_PLANES_TRABAJO,
  extraerDatosArchivoPlan,
  type MiComisionRecord,
  type MiComisionIntegrante,
  type PlanTrabajoRecord,
} from "./zod";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface UsuarioContexto {
  supabase: SupabaseServerClient;
  userId: string;
  rol: string;
  municipioId: number;
  esAdminOSuper: boolean;
}

async function obtenerContextoUsuario(): Promise<
  | { ctx: UsuarioContexto; error: null }
  | { ctx: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ctx: null, error: "UNAUTHORIZED" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nombre, rol, municipio_id")
    .eq("id", user.id)
    .maybeSingle();

  const rol = (
    (profile?.rol as string | null) ??
    (user.user_metadata?.rol as string | null) ??
    user.role ??
    "user"
  )
    .toLowerCase()
    .trim();

  let municipioId: number | null = (profile?.municipio_id as number | null) ?? null;

  if (rol === "super") {
    const cookie = await getGlobalMunicipioCookie();
    if (cookie?.id) {
      municipioId = cookie.id;
    }
  }

  if (!municipioId) {
    return { ctx: null, error: "NO_MUNICIPIO" };
  }

  return {
    ctx: {
      supabase,
      userId: user.id,
      rol,
      municipioId,
      esAdminOSuper: isSuperOrAdminRole(rol),
    },
    error: null,
  };
}

/**
 * Verifica si el usuario actual pertenece a al menos una comisión activa.
 */
export async function verificarEsMiembroComision(): Promise<boolean> {
  const { ctx } = await obtenerContextoUsuario();
  if (!ctx) return false;

  const { count, error } = await ctx.supabase
    .from("comision_integrantes")
    .select("id", { count: "exact", head: true })
    .eq("id_integrante", ctx.userId);

  if (error || !count) return false;
  return count > 0;
}

/**
 * Hidrata una lista de filas de `comisiones` con sus integrantes y plan de trabajo para el año dado.
 */
async function construirComisionesConDetalles(
  ctx: UsuarioContexto,
  comisiones: Array<Record<string, unknown>>,
  año: number,
): Promise<{ data: MiComisionRecord[] | null; error: string | null }> {
  if (comisiones.length === 0) {
    return { data: [], error: null };
  }

  const comisionIdsValidos = comisiones.map((c) => c.id as string);

  const [resIntegrantes, resPlanes] = await Promise.all([
    ctx.supabase
      .from("comision_integrantes")
      .select("*")
      .in("id_comision", comisionIdsValidos)
      .eq("año", año),
    ctx.supabase
      .from("comision_planes_trabajo")
      .select("*")
      .in("id_comision", comisionIdsValidos)
      .eq("año", año)
      .order("created_at", { ascending: false }),
  ]);

  if (resIntegrantes.error) {
    return { data: null, error: resIntegrantes.error.message };
  }
  if (resPlanes.error) {
    return { data: null, error: resPlanes.error.message };
  }

  const todosIntegrantes = resIntegrantes.data ?? [];
  const todosPlanes = resPlanes.data ?? [];

  const profileIdsSet = new Set<string>();
  for (const int of todosIntegrantes) {
    if (int.id_integrante) profileIdsSet.add(int.id_integrante as string);
  }
  for (const plan of todosPlanes) {
    if (plan.subido_por) profileIdsSet.add(plan.subido_por as string);
  }

  const profileIds = Array.from(profileIdsSet);
  const profileMap = new Map<
    string,
    { id: string; nombre: string; dpi?: string; rol?: string }
  >();

  if (profileIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, nombre, dpi, rol")
      .in("id", profileIds);

    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, {
        id: p.id as string,
        nombre: (p.nombre as string) ?? "Usuario",
        dpi: p.dpi as string | undefined,
        rol: p.rol as string | undefined,
      });
    }
  }

  const integrantesPorComision = new Map<string, MiComisionIntegrante[]>();
  for (const int of todosIntegrantes) {
    const cId = int.id_comision as string;
    const prof = profileMap.get(int.id_integrante as string);
    const item: MiComisionIntegrante = {
      id: int.id as string,
      id_comision: cId,
      id_integrante: int.id_integrante as string,
      año: int.año as number,
      nombre: prof?.nombre ?? "Usuario",
      dpi: prof?.dpi,
      rol: prof?.rol,
      es_coordinador: Boolean(int.es_coordinador),
    };
    const lista = integrantesPorComision.get(cId) ?? [];
    lista.push(item);
    integrantesPorComision.set(cId, lista);
  }

  // Ordenar integrantes de cada comisión: coordinador primero, luego alfabéticamente
  for (const [, lista] of integrantesPorComision) {
    lista.sort((a, b) => {
      if (a.es_coordinador && !b.es_coordinador) return -1;
      if (!a.es_coordinador && b.es_coordinador) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }

  const planPorComision = new Map<string, PlanTrabajoRecord>();
  for (const plan of todosPlanes) {
    const cId = plan.id_comision as string;
    if (!planPorComision.has(cId)) {
      const uploader = plan.subido_por
        ? profileMap.get(plan.subido_por as string)
        : undefined;
      planPorComision.set(cId, {
        id: plan.id as string,
        id_comision: cId,
        año: plan.año as number,
        archivo_url: plan.archivo_url,
        subido_por: (plan.subido_por as string | null) ?? null,
        subido_por_nombre: uploader?.nombre ?? null,
        created_at: plan.created_at as string,
      });
    }
  }

  const resultado: MiComisionRecord[] = comisiones.map((c) => ({
    id: c.id as string,
    municipio_id: c.municipio_id as number,
    nombre: c.nombre as string,
    descripcion: (c.descripcion as string | null) ?? null,
    activo: Boolean(c.activo),
    orden: (c.orden as number | null) ?? null,
    año,
    integrantes: integrantesPorComision.get(c.id as string) ?? [],
    plan_trabajo: planPorComision.get(c.id as string) ?? null,
  }));

  return { data: resultado, error: null };
}

/**
 * Lista las comisiones a las que pertenece el usuario en el año indicado,
 * incluyendo sus compañeros integrantes y el plan de trabajo cargado para ese año.
 */
export async function listarMisComisionesPorAnio(año: number): Promise<{
  data: MiComisionRecord[] | null;
  error: string | null;
}> {
  const { ctx, error: authError } = await obtenerContextoUsuario();
  if (authError || !ctx) {
    return { data: null, error: authError };
  }

  const { data: misAsignaciones, error: errMisAsig } = await ctx.supabase
    .from("comision_integrantes")
    .select("id_comision")
    .eq("id_integrante", ctx.userId)
    .eq("año", año);

  if (errMisAsig) {
    return { data: null, error: errMisAsig.message };
  }

  const misComisionIds = Array.from(
    new Set((misAsignaciones ?? []).map((a) => a.id_comision as string)),
  );

  if (misComisionIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: comisionesData, error: errComisiones } = await ctx.supabase
    .from("comisiones")
    .select("*")
    .eq("municipio_id", ctx.municipioId)
    .eq("activo", true)
    .in("id", misComisionIds)
    .order("orden", { ascending: true, nullsFirst: false });

  if (errComisiones) {
    return { data: null, error: errComisiones.message };
  }

  return construirComisionesConDetalles(ctx, comisionesData ?? [], año);
}

/**
 * Lista todas las comisiones activas del municipio para el año indicado (exclusivo para super y admin),
 * incluyendo sus integrantes y planes de trabajo.
 */
export async function listarTodasComisionesPorAnio(año: number): Promise<{
  data: MiComisionRecord[] | null;
  error: string | null;
}> {
  const { ctx, error: authError } = await obtenerContextoUsuario();
  if (authError || !ctx) {
    return { data: null, error: authError };
  }

  if (!ctx.esAdminOSuper) {
    return { data: null, error: "FORBIDDEN" };
  }

  const { data: comisionesData, error: errComisiones } = await ctx.supabase
    .from("comisiones")
    .select("*")
    .eq("municipio_id", ctx.municipioId)
    .eq("activo", true)
    .order("orden", { ascending: true, nullsFirst: false });

  if (errComisiones) {
    return { data: null, error: errComisiones.message };
  }

  return construirComisionesConDetalles(ctx, comisionesData ?? [], año);
}

/**
 * Guarda o reemplaza el Plan de Trabajo de una comisión para un año específico.
 * Si ya existía un registro para esa comisión y año, borra el archivo anterior del Storage y actualiza la fila.
 */
export async function guardarPlanTrabajoComision(params: {
  idComision: string;
  año: number;
  archivoPath: string;
  nombreArchivo?: string;
}): Promise<{ success: boolean; error: string | null }> {
  const { ctx, error: authError } = await obtenerContextoUsuario();
  if (authError || !ctx) {
    return { success: false, error: authError ?? "No autenticado" };
  }

  const { idComision, año, archivoPath, nombreArchivo } = params;

  const { data: comision } = await ctx.supabase
    .from("comisiones")
    .select("id, municipio_id")
    .eq("id", idComision)
    .eq("municipio_id", ctx.municipioId)
    .maybeSingle();

  if (!comision) {
    return { success: false, error: "La comisión no existe en este municipio." };
  }

  const esSuper = ctx.rol === "super";

  if (!esSuper) {
    const { data: membresia } = await ctx.supabase
      .from("comision_integrantes")
      .select("id")
      .eq("id_comision", idComision)
      .eq("id_integrante", ctx.userId)
      .eq("año", año)
      .maybeSingle();

    if (!membresia) {
      return {
        success: false,
        error: "Solo los integrantes de esta comisión o un superadministrador pueden cargar o actualizar el plan de trabajo.",
      };
    }
  }

  const { data: existentes } = await ctx.supabase
    .from("comision_planes_trabajo")
    .select("id, archivo_url")
    .eq("id_comision", idComision)
    .eq("año", año);

  const nuevoJsonArchivo = {
    path: archivoPath,
    nombre: nombreArchivo || archivoPath.split("/").pop() || `Plan_${año}.pdf`,
  };

  if (existentes && existentes.length > 0) {
    const principal = existentes[0];

    const pathsABorrar: string[] = [];
    for (const reg of existentes) {
      const { path: oldPath } = extraerDatosArchivoPlan(reg.archivo_url);
      if (oldPath && oldPath !== archivoPath && !oldPath.startsWith("http")) {
        pathsABorrar.push(oldPath);
      }
    }

    if (pathsABorrar.length > 0) {
      await ctx.supabase.storage.from(BUCKET_PLANES_TRABAJO).remove(pathsABorrar);
    }

    if (existentes.length > 1) {
      const idsExtra = existentes.slice(1).map((r) => r.id as string);
      await ctx.supabase.from("comision_planes_trabajo").delete().in("id", idsExtra);
    }

    const { error: updateErr } = await ctx.supabase
      .from("comision_planes_trabajo")
      .update({
        archivo_url: nuevoJsonArchivo,
        subido_por: ctx.userId,
        created_at: new Date().toISOString(),
      })
      .eq("id", principal.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, error: null };
  }

  const { error: insertErr } = await ctx.supabase
    .from("comision_planes_trabajo")
    .insert({
      id_comision: idComision,
      año,
      archivo_url: nuevoJsonArchivo,
      subido_por: ctx.userId,
    });

  if (insertErr) {
    return { success: false, error: insertErr.message };
  }

  return { success: true, error: null };
}

/**
 * Elimina el Plan de Trabajo de una comisión en un año determinado (tanto de Storage como de la BD).
 */
export async function eliminarPlanTrabajoComision(params: {
  idComision: string;
  año: number;
}): Promise<{ success: boolean; error: string | null }> {
  const { ctx, error: authError } = await obtenerContextoUsuario();
  if (authError || !ctx) {
    return { success: false, error: authError ?? "No autenticado" };
  }

  const { idComision, año } = params;

  const esSuper = ctx.rol === "super";

  if (!esSuper) {
    const { data: membresia } = await ctx.supabase
      .from("comision_integrantes")
      .select("id")
      .eq("id_comision", idComision)
      .eq("id_integrante", ctx.userId)
      .eq("año", año)
      .maybeSingle();

    if (!membresia) {
      return {
        success: false,
        error: "Solo los integrantes de esta comisión o un superadministrador pueden eliminar el plan de trabajo.",
      };
    }
  }

  const { data: existentes, error: fetchErr } = await ctx.supabase
    .from("comision_planes_trabajo")
    .select("id, archivo_url")
    .eq("id_comision", idComision)
    .eq("año", año);

  if (fetchErr) {
    return { success: false, error: fetchErr.message };
  }

  if (!existentes || existentes.length === 0) {
    return { success: true, error: null };
  }

  const pathsABorrar: string[] = [];
  for (const reg of existentes) {
    const { path } = extraerDatosArchivoPlan(reg.archivo_url);
    if (path && !path.startsWith("http")) {
      pathsABorrar.push(path);
    }
  }

  if (pathsABorrar.length > 0) {
    await ctx.supabase.storage.from(BUCKET_PLANES_TRABAJO).remove(pathsABorrar);
  }

  const ids = existentes.map((r) => r.id as string);
  const { error: delErr } = await ctx.supabase
    .from("comision_planes_trabajo")
    .delete()
    .in("id", ids);

  if (delErr) {
    return { success: false, error: delErr.message };
  }

  return { success: true, error: null };
}
