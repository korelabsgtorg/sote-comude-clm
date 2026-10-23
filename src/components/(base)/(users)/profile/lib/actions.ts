"use server";

import { createClient } from "@/utils/supabase/server";
import {
  createClient as createSupabaseAdmin,
  type AdminUserAttributes,
} from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { ProfileFormValues } from "./schemas";

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

export async function getProfileById(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    if (data.rol === "cocode") {
      data.rol = "comude";
    } else if (!data.rol) {
      try {
        const supabaseAdmin = getAdminClient();
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authData?.user?.user_metadata?.rol) {
          const metaRol = authData.user.user_metadata.rol;
          data.rol = metaRol === "cocode" ? "comude" : metaRol;
        }
      } catch (e) {
        console.error("Error fetching auth user metadata fallback:", e);
      }
    }
  }

  return data;
}

export async function getUserAuthData(userId: string) {
  const supabaseAdmin = getAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !data.user) {
    return { username: "", phone: "", banned_until: null, rol: null };
  }

  const meta = data.user.user_metadata || {};
  const userWithBan = data.user as { banned_until?: string } & typeof data.user;
  const metaRol = meta.rol === "cocode" ? "comude" : meta.rol;

  return {
    username: meta.username || data.user.email?.split("@")[0] || "",
    phone: meta.phone || data.user.phone || "",
    banned_until: userWithBan.banned_until || null,
    rol: metaRol || null,
  };
}

export async function updateProfile(
  userId: string,
  formData: Partial<ProfileFormValues>,
) {
  const supabase = await createClient();
  const supabaseAdmin = getAdminClient();

  const rawData = {
    nombre: formData.nombre,
    email: formData.email,
    telefono: formData.telefono,
    dpi: formData.dpi,
    nit: formData.nit,
    direccion: formData.direccion,
    fecha_nacimiento: formData.fecha_nacimiento,
    genero: formData.genero,
    contacto_emergencia: formData.contacto_emergencia,
    telefono_emergencia: formData.telefono_emergencia,
    rol: formData.rol,
    organizacion_id: formData.organizacion_id,
    municipio_id: formData.municipio_id,
  };

  const profileData: Record<string, unknown> = Object.fromEntries(
    Object.entries(rawData).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );

  if (formData.organizacion_id === "" || formData.organizacion_id === null) {
    profileData.organizacion_id = null;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileData)
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const metadataUpdates: Record<string, string | null> = {};

  if (formData.telefono) metadataUpdates.phone = formData.telefono;
  if (formData.nombre) metadataUpdates.nombre = formData.nombre;
  if (formData.rol) metadataUpdates.rol = formData.rol;
  if (formData.organizacion_id !== undefined) {
    metadataUpdates.organizacion_id = formData.organizacion_id || null;
  }

  if (Object.keys(metadataUpdates).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: metadataUpdates,
      },
    );

    if (authError) {
      console.error("Error updating auth metadata:", authError);
    }
  }

  return { success: true };
}

export async function updateUserCredentials(
  userId: string,
  username?: string,
  password?: string,
) {
  if (!username && !password) return { success: true };

  const supabaseAdmin = getAdminClient();
  const authUpdates: AdminUserAttributes = {};

  if (password) {
    authUpdates.password = password;
  }

  if (username) {
    authUpdates.email = `${username}@app.com`;
    authUpdates.email_confirm = true;

    // Preservamos el resto de metadata (name, nombre, rol, organizacion_id...)
    // para no borrar el nombre al cambiar el usuario.
    const { data: existing } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    authUpdates.user_metadata = {
      ...(existing?.user?.user_metadata ?? {}),
      username: username,
    };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    authUpdates,
  );

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function toggleUserStatus(userId: string, isBanned: boolean) {
  const supabaseAdmin = getAdminClient();

  const banDuration = isBanned ? "876600h" : "none";

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/comude/admin/usuarios");
  return { success: true };
}
