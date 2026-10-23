"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface LogoMunicipioItem {
  id: string;
  titulo: string;
  path: string;
  created_at: string;
}

export type TipoRegistroFirmaSello = "firma" | "sello";

export interface FirmaMunicipioItem {
  id: string;
  titulo: string;
  path: string;
  tipo?: TipoRegistroFirmaSello;
  created_at: string;
}

export interface ConvocatoriaConfig {
  logo_izquierda_path?: string | null;
  logo_derecha_path?: string | null;
  coordinador_id?: string | null;
  coordinador_nombre?: string | null;
  coordinador_puesto?: string | null;
  firma_path?: string | null;
  sello_path?: string | null;
  destinatarios_default?: string | null;
}

export interface IntegranteEstructura {
  id: string;
  nombre: string;
  puesto: string;
}

export interface ConfiguracionMunicipio {
  municipio_id: number;
  imagen_portada_url: string | null;
  minutos_antes_permitidos: number;
  minutos_despues_permitidos: number;
  logo: LogoMunicipioItem[] | null;
  convocatoria_config: ConvocatoriaConfig | null;
  firmas: FirmaMunicipioItem[] | null;
  created_at: string;
  updated_at: string;
}

export async function getConfiguracionMunicipio(
  municipioId: number
): Promise<ConfiguracionMunicipio | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuraciones_municipio")
    .select("municipio_id, imagen_portada_url, minutos_antes_permitidos, minutos_despues_permitidos, logo, convocatoria_config, firmas, created_at, updated_at")
    .eq("municipio_id", municipioId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertConfiguracionMunicipio(
  municipioId: number,
  imagenPortadaUrl: string | null,
  minutosAntes: number,
  minutosDespues: number,
  logo?: LogoMunicipioItem[] | null,
  convocatoriaConfig?: ConvocatoriaConfig | null,
  firmas?: FirmaMunicipioItem[] | null
): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { error } = await supabase
    .from("configuraciones_municipio")
    .upsert(
      {
        municipio_id: municipioId,
        imagen_portada_url: imagenPortadaUrl,
        minutos_antes_permitidos: minutosAntes,
        minutos_despues_permitidos: minutosDespues,
        logo: logo !== undefined ? logo : null,
        convocatoria_config: convocatoriaConfig !== undefined ? convocatoriaConfig : null,
        firmas: firmas !== undefined ? firmas : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "municipio_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

export async function getIntegrantesEstructuraMunicipio(
  municipioId: number
): Promise<IntegranteEstructura[]> {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, nombre, puestos(nombre)")
    .eq("municipio_id", municipioId);

  if (error || !profiles) return [];

  return profiles.map((p: any) => ({
    id: p.id,
    nombre: p.nombre || "Sin nombre",
    puesto: Array.isArray(p.puestos) ? p.puestos[0]?.nombre || "Sin puesto" : p.puestos?.nombre || "Sin puesto",
  }));
}
