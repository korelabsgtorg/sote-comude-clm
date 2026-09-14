"use client";

import { createBrowserClient } from "@supabase/ssr";
import { toast } from "react-toastify";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface AgendaConcejo {
  id: string;
  titulo: string;
  descripcion: string;
  fecha_reunion: string;
  hora_reunion: string | null;
  acta: string | null;
  estado: string;
  inicio: string | null;
  fin: string | null;
}

export const fetchAsistenciaGlobalAgenda = async (agendaId: string) => {
  const { data: registros, error: errorRegistros } = await supabase
    .from("registros_agenda")
    .select("*, remunerado")
    .eq("agenda_id", agendaId);

  if (errorRegistros) {
    return [];
  }

  if (!registros || registros.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(registros.map((r) => r.user_id)));

  const { data: datosUsuarios, error: errorUsuarios } = await supabase
    .from("info_usuario")
    .select(
      `
      user_id,
      nombre, 
      dependencias!info_usuario_dependencia_id_fkey (
        nombre
      )
    `,
    )
    .in("user_id", userIds);

  if (errorUsuarios) {
    return registros.map((r) => ({
      ...r,
      usuarios: { id: r.user_id, nombre: "Error carga", puesto: "-" },
    }));
  }

  const registrosConUsuario = registros.map((registro) => {
    const infoUsuario = datosUsuarios?.find(
      (u) => u.user_id === registro.user_id,
    );
    const dependenciaData = infoUsuario?.dependencias as any;
    const nombrePuesto = dependenciaData?.nombre || "Sin dependencia";

    return {
      ...registro,
      remunerado: registro.remunerado ?? false,
      usuarios: {
        id: registro.user_id,
        nombre: infoUsuario?.nombre || "Desconocido",
        puesto: nombrePuesto,
      },
    };
  });

  return registrosConUsuario;
};

export const fetchAgendaConcejoPorId = async (
  id: string,
): Promise<AgendaConcejo | null> => {
  const { data, error } = await supabase
    .from("agenda_concejo")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }
  return data as AgendaConcejo;
};

export const actualizarRemunerado = async (
  agendaId: string,
  userId: string,
  remunerado: boolean,
): Promise<boolean> => {
  const { error } = await supabase
    .from("registros_agenda")
    .update({ remunerado })
    .eq("agenda_id", agendaId)
    .eq("user_id", userId);

  if (error) {
    toast.error("Error al actualizar remuneración");
    return false;
  }
  return true;
};
