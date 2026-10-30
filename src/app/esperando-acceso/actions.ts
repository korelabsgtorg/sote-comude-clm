"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { sendPushToRoles } from "@/utils/push-utils";

async function notifySpecialRoles(userName: string, isResend: boolean, municipioId?: string | number | null) {
  const roles = ["super", "admin"];
  const title = isResend ? "Nueva Solicitud de Acceso" : "Usuario Esperando Acceso";
  const body = isResend 
    ? `${userName} ha vuelto a enviar su solicitud para autorizar este dispositivo.`
    : `${userName} está en la pantalla de espera de autorización de dispositivo.`;
  
  await sendPushToRoles(roles, {
    title,
    body,
    url: "/comude/admin/dispositivos" // Assuming this is where admins manage devices
  }, municipioId);
}

export async function checkDeviceRequest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return true;

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "Desconocido";

  const { data } = await supabase
    .from("authorized_devices")
    .select("id")
    .eq("user_id", user.id)
    .eq("browser_fingerprint", userAgent)
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function createDeviceRequest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "Desconocido";

  const { error } = await supabase.from("authorized_devices").insert({
    user_id: user.id,
    device_name: userAgent,
    browser_fingerprint: userAgent,
    is_authorized: false,
  });

  if (error) return { success: false, error: error.message };

  // Notify of resend/new request
  const { data: profile } = await supabase.from("profiles").select("nombre, municipio_id").eq("id", user.id).maybeSingle();
  const userName = profile?.nombre || user.email?.split("@")[0] || "Usuario";
  await notifySpecialRoles(userName, true, profile?.municipio_id);

  return { success: true };
}

export async function notifyAdminsOfArrival() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: profile } = await supabase.from("profiles").select("nombre, municipio_id").eq("id", user.id).maybeSingle();
  const userName = profile?.nombre || user.email?.split("@")[0] || "Usuario";
  
  await notifySpecialRoles(userName, false, profile?.municipio_id);
}
