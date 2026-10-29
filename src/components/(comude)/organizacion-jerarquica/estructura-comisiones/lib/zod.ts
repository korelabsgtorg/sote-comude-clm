import { z } from "zod";

export const comisionSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional().nullable(),
});

export type ComisionFormValues = z.infer<typeof comisionSchema>;

export interface ComisionRecord {
  id: string;
  municipio_id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  orden?: number | null;
}

export interface ComisionIntegranteRecord {
  id: string;
  id_comision: string;
  id_integrante: string;
  año: number;
  created_at: string;
  nombre?: string;
  dpi?: string;
  rol?: string;
  es_coordinador?: boolean;
}

export interface PersonaElegible {
  id: string;
  nombre: string;
  dpi?: string;
  rol?: string;
}

export const asignarIntegranteSchema = z.object({
  id_integrante: z.string().uuid("Debe seleccionar un integrante válido"),
  año: z.number().int().min(2000).max(2100),
  es_coordinador: z.boolean().optional(),
});

export type AsignarIntegranteValues = z.infer<typeof asignarIntegranteSchema>;

export {
  BUCKET_PLANES_TRABAJO,
  extraerDatosArchivoPlan,
  type PlanTrabajoRecord,
} from "@/components/(comude)/comisiones/lib/zod";
