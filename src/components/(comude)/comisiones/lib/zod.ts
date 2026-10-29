import { z } from "zod";

export const BUCKET_PLANES_TRABAJO = "planes_trabajo";
export const MAX_PLAN_TRABAJO_SIZE = 10 * 1024 * 1024; // 10 MB

export const planTrabajoArchivoSchema = z.object({
  path: z.string().min(1, "La ruta del archivo es requerida"),
  nombre: z.string().optional(),
  url: z.string().optional(),
});

export type PlanTrabajoArchivo = z.infer<typeof planTrabajoArchivoSchema>;

export interface PlanTrabajoRecord {
  id: string;
  id_comision: string;
  año: number;
  archivo_url: PlanTrabajoArchivo | string | null;
  subido_por: string | null;
  subido_por_nombre?: string | null;
  created_at: string;
}

export interface MiComisionIntegrante {
  id: string;
  id_comision: string;
  id_integrante: string;
  año: number;
  nombre: string;
  dpi?: string;
  rol?: string;
  es_coordinador?: boolean;
}

export interface MiComisionRecord {
  id: string;
  municipio_id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  orden?: number | null;
  año: number;
  integrantes: MiComisionIntegrante[];
  plan_trabajo: PlanTrabajoRecord | null;
}

/**
 * Extrae de forma segura el path en storage y el nombre del archivo
 * desde la columna JSONB `archivo_url`.
 */
export function extraerDatosArchivoPlan(archivo_url: unknown): {
  path: string | null;
  nombre: string;
} {
  if (!archivo_url) {
    return { path: null, nombre: "Plan de Trabajo.pdf" };
  }

  if (typeof archivo_url === "string") {
    const cleanName = archivo_url.split("/").pop() || "Plan de Trabajo.pdf";
    return { path: archivo_url, nombre: cleanName };
  }

  if (Array.isArray(archivo_url) && archivo_url.length > 0) {
    return extraerDatosArchivoPlan(archivo_url[0]);
  }

  if (typeof archivo_url === "object") {
    const obj = archivo_url as Record<string, unknown>;
    const path =
      typeof obj.path === "string"
        ? obj.path
        : typeof obj.ruta_storage === "string"
          ? obj.ruta_storage
          : typeof obj.url === "string"
            ? obj.url
            : null;
    const nombre =
      typeof obj.nombre === "string" && obj.nombre.trim().length > 0
        ? obj.nombre
        : path
          ? path.split("/").pop() || "Plan de Trabajo.pdf"
          : "Plan de Trabajo.pdf";
    return { path, nombre };
  }

  return { path: null, nombre: "Plan de Trabajo.pdf" };
}

/**
 * Formatea una fecha en formato corto legible en español:
 * Ej: "Lun 28 De Sep, 2026"
 */
export function formatFechaCorto(isoStr?: string | null): string {
  if (!isoStr) return "";
  const fecha = new Date(isoStr);
  if (isNaN(fecha.getTime())) return "";
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const year = String(fecha.getFullYear()).slice(-2);
  return `${dias[fecha.getDay()]} ${fecha.getDate()} De ${meses[fecha.getMonth()]}, ${year}`;
}

