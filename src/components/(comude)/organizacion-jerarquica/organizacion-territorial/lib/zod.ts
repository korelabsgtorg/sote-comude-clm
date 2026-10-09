import { z } from "zod";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoLugar = "microrregion" | "aldea" | "caserio";

export const TIPO_LABELS: Record<TipoLugar, string> = {
  microrregion: "Microrregión",
  aldea: "Aldea",
  caserio: "Caserío",
};

export const TIPOS_HIJOS: Record<TipoLugar, TipoLugar | null> = {
  microrregion: "aldea",
  aldea: "caserio",
  caserio: null,
};

export interface ComunidadRecord {
  id: string;
  municipio_id: number;
  parent_id: string | null;
  nombre: string;
  tipo: TipoLugar;
}

export interface PersonaResidente {
  id: string;
  nombre: string;
  email: string | null;
  dpi: string | null;
}

export interface PersonaTerritorioOption {
  id: string;
  nombre: string;
  email: string | null;
  dpi: string | null;
  comunidad_id: string | null;
  comunidad_nombre?: string | null;
}

import type { PuestoRecord } from "../../organizacion-jerarquica/lib/zod";

export interface NodoTerritorial {
  id: string;
  nombre: string;
  tipo: TipoLugar;
  personas_count: number;
  residentes: PersonaResidente[];
  hijos: NodoTerritorial[];
  puestos?: PuestoRecord[];
  resolucion_vigente?: CocodePeriodo | null;
}

// ─── Zod ─────────────────────────────────────────────────────────────────────

export const comunidadFormSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.enum(["microrregion", "aldea", "caserio"]),
  parent_id: z.string().nullable(),
});

export type ComunidadFormValues = z.infer<typeof comunidadFormSchema>;

export const asignarPersonaComunidadSchema = z.object({
  profile_id: z.string(),
  comunidad_id: z.string().nullable(),
});

export type AsignarPersonaComunidadValues = z.infer<typeof asignarPersonaComunidadSchema>;

// ─── Resoluciones y COCODE Periodos ──────────────────────────────────────────

export type EstadoVigencia = "vigente" | "por_vencer" | "vencido" | "sin_resolucion";

export interface CocodeResolucionFileItem {
  id: string;
  nombre: string;
  file_path: string;
  created_at: string;
}

export interface CocodeResolucionData {
  titulo: string;
  archivos: CocodeResolucionFileItem[];
}

export interface CocodePeriodo {
  id: string;
  comunidad_id: string;
  municipio_id: number;
  resolucion: CocodeResolucionData;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  estado_vigencia?: EstadoVigencia;
  dias_restantes?: number;
}

export interface CocodeHistoricoPuesto {
  id: string;
  periodo_id: string;
  nombre_puesto: string;
  es_presidente: boolean;
  titular_nombre: string | null;
  fecha_asignacion: string | null;
  created_at: string;
}

export interface PeriodoConHistorico extends CocodePeriodo {
  historico_puestos?: CocodeHistoricoPuesto[];
}

// ─── Helpers de Búsqueda y Validación de Duplicados ───────────────────────────

export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface LugarPlano {
  id: string;
  nombre: string;
  tipo: TipoLugar;
  parentId: string | null;
  parentNombre: string | null;
  fullPath: string;
}

export function aplanarLugares(
  nodos: NodoTerritorial[],
  parentId: string | null = null,
  parentNombre: string | null = null,
  ancestorPath: string[] = [],
): LugarPlano[] {
  const result: LugarPlano[] = [];
  for (const nodo of nodos) {
    const currentPath = [...ancestorPath, nodo.nombre];
    result.push({
      id: nodo.id,
      nombre: nodo.nombre,
      tipo: nodo.tipo,
      parentId,
      parentNombre,
      fullPath: currentPath.join(" → "),
    });
    if (nodo.hijos && nodo.hijos.length > 0) {
      result.push(
        ...aplanarLugares(nodo.hijos, nodo.id, nodo.nombre, currentPath),
      );
    }
  }
  return result;
}

export function buscarLugarDuplicado(
  nombre: string,
  lugares: LugarPlano[],
  ignoreId?: string | null,
): LugarPlano | null {
  const norm = normalizeText(nombre);
  if (!norm) return null;
  return (
    lugares.find(
      (l) => l.id !== ignoreId && normalizeText(l.nombre) === norm,
    ) ?? null
  );
}

