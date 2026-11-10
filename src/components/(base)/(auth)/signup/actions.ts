"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { authSchema } from "./schemas";
import { canAssignRole } from "@/components/(base)/(users)/usuarios/lib/permissions";

export async function getOrganizaciones() {
  // Los módulos de observatorio han sido eliminados.
  // Retornamos un array vacío para evitar consultar una tabla inexistente.
  return [];
}

export async function getDepartamentos() {
  const supabase = await createClient();
  const { data } = await supabase.from("lug_departamentos").select("id, nombre").order("nombre");
  return data || [];
}

export async function getMunicipios(departamentoId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lug_municipios")
    .select("id, nombre")
    .eq("departamento_id", departamentoId)
    .order("nombre");
  return data || [];
}

export async function crearDepartamento(nombre: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lug_departamentos")
    .insert({ nombre })
    .select("id, nombre")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function crearMunicipio(departamentoId: number, nombre: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lug_municipios")
    .insert({ departamento_id: departamentoId, nombre })
    .select("id, nombre")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export type ActionState = {
  success?: boolean;
  message?: string;
  errors?: {
    [key: string]: string[];
  };
  username?: string;
} | null;

export async function obtenerUsernameDisponible(baseUsername: string): Promise<string> {
  const cleanBase = baseUsername
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

  if (!cleanBase) return "";

  try {
    const supabaseAdmin = getAdminClient();
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error || !usersData?.users) {
      return cleanBase;
    }

    const taken = new Set();
    for (const u of usersData.users) {
      if (u.email) {
        const emailUser = u.email.split("@")[0].toLowerCase();
        taken.add(emailUser);
      }
      if (u.user_metadata?.username) {
        taken.add(String(u.user_metadata.username).toLowerCase());
      }
    }

    if (!taken.has(cleanBase)) {
      return cleanBase;
    }

    let counter = 2;
    while (taken.has(`${cleanBase}${counter}`)) {
      counter++;
    }

    return `${cleanBase}${counter}`;
  } catch (err) {
    console.error("[obtenerUsernameDisponible] Error:", err);
    return cleanBase;
  }
}

export async function signup(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = {
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    rol: formData.get("rol"),
    organizacion_id: formData.get("organizacion_id") || undefined,
    municipio_id: formData.get("municipio_id") || undefined,
  };

  const validated = authSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { name, username, password, rol, organizacion_id, municipio_id } = validated.data;

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  const actorRole = actor?.user_metadata?.rol || "user";

  if (!canAssignRole(actorRole, rol)) {
    return {
      errors: {
        rol: ["No tienes permisos para asignar este rol."],
      },
    };
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("municipio_id, rol")
    .eq("id", actor?.id)
    .single();

  let finalMunicipioId = null;
  if (actorProfile?.rol === "super") {
    finalMunicipioId = municipio_id ?? null;
  } else {
    finalMunicipioId = actorProfile?.municipio_id ?? null;
  }

  const supabaseAdmin = getAdminClient();

  let finalUsername = username;
  let candidateUsername = username;
  let attempt = 1;
  const baseUser = username.replace(/\d+$/, "");

  let createdUser = null;
  let createError = null;

  while (attempt <= 15) {
    const fakeEmail = `${candidateUsername}@app.com`;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name,
        nombre: name,
        username: candidateUsername,
        rol,
        organizacion_id: organizacion_id ?? null,
        municipio_id: finalMunicipioId,
      },
    });

    if (error && (error.message.includes("already registered") || error.status === 422)) {
      attempt++;
      candidateUsername = `${baseUser}${attempt}`;
      continue;
    }

    if (error) {
      createError = error;
      break;
    }

    createdUser = data?.user;
    finalUsername = candidateUsername;
    break;
  }

  if (createError || !createdUser) {
    console.error("[signup] createUser error:", createError);
    return { message: translateError(createError?.message || "No se pudo crear el usuario.") };
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: createdUser.id,
        nombre: name,
        rol: rol,
        organizacion_id: organizacion_id ?? null,
        municipio_id: finalMunicipioId,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    console.error("[signup] profile upsert error:", profileError);
    await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
    return {
      message:
        "No se pudo guardar el perfil del usuario: " +
        translateError(profileError.message),
    };
  }

  return { success: true, username: finalUsername };
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("duplicate key") && m.includes("unique constraint")) {
    return "Ya existe un registro con esos datos (usuario duplicado).";
  }
  if (m.includes("violates foreign key")) {
    return "Referencia inválida en la base de datos. Contacta al administrador.";
  }
  if (m.includes("violates check constraint")) {
    return "Algún valor no cumple las reglas de la base de datos (revisa el rol).";
  }
  if (m.includes("violates not-null")) {
    return "Falta un campo obligatorio en la base de datos.";
  }
  if (m.includes("row-level security") || m.includes("rls")) {
    return "No tienes permisos para realizar esta acción (RLS).";
  }
  if (m.includes("invalid api key") || m.includes("jwt")) {
    return "Configuración de Supabase inválida (revisa SUPABASE_SERVICE_ROLE_KEY).";
  }
  if (m.includes("password") && m.includes("weak")) {
    return "La contraseña es demasiado débil.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Error de conexión con el servidor. Intenta de nuevo.";
  }
  return "Error al crear el usuario: " + msg;
}

export async function getAllMunicipios() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lug_municipios")
    .select("id, nombre, lug_departamentos(nombre)")
    .order("nombre");
  return data || [];
}
