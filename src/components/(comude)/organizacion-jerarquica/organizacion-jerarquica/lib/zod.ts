import { z } from "zod";

export type AcreditacionFile = {
  id: string;
  nombre: string;
  file_path: string;
  created_at: string;
};

export const nodoOrganizacionSchema: z.ZodType<{
  id: string;
  nombre: string;
  tipo: "raiz" | "nivel" | "institucion" | "unidad";
  descripcion?: string;
  tiene_jefaturas?: boolean;
  titular?: string;
  titular_id?: string;
  fecha?: string | null;
  activo?: boolean;
  acreditaciones?: AcreditacionFile[];
  hijos?: NodoOrganizacion[];
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    tipo: z.enum(["raiz", "nivel", "institucion", "unidad"]),
    descripcion: z.string().optional(),
    tiene_jefaturas: z.boolean().optional(),
    titular: z.string().optional(),
    titular_id: z.string().uuid().optional(),
    fecha: z.string().nullable().optional(),
    activo: z.boolean().optional(),
    acreditaciones: z.array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        file_path: z.string(),
        created_at: z.string(),
      }),
    ).optional(),
    hijos: z.array(nodoOrganizacionSchema).optional(),
  }),
);

export type NodoOrganizacion = z.infer<typeof nodoOrganizacionSchema>;

export const ESTRUCTURA_VACIA: NodoOrganizacion = {
  id: "comude",
  nombre: "COMUDE",
  tipo: "raiz",
  descripcion:
    "Estructura del Consejo Municipal de Desarrollo (COMUDE).",
  hijos: [],
};

export const departamentoFormSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  parent_id: z.string().uuid().nullable().default(null),
  descripcion: z.string().trim().max(500).optional().default(""),
  orden: z.coerce.number().int().min(0).default(0),
  comunidad_id: z.string().nullable().optional().default(null),
  jalar_jefes_territoriales: z.boolean().optional().default(false),
});

export type DepartamentoFormValues = z.infer<typeof departamentoFormSchema>;

export const puestoFormSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  departamento_id: z.string().uuid("Seleccione un departamento"),
  jefatura_ids: z.array(z.string().uuid()).default([]),
  orden: z.coerce.number().int().min(0).default(0),
  fecha: z.string().nullable().optional().default(null),
  activo: z.boolean().default(true),
  acreditaciones: z
    .array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        file_path: z.string(),
        created_at: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type PuestoFormValues = z.infer<typeof puestoFormSchema>;

export type DepartamentoRecord = {
  id: string;
  nombre: string;
  parent_id: string | null;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  comunidad_id: string | null;
  jalar_jefes_territoriales?: boolean;
};

export type PuestoRecord = {
  id: string;
  nombre: string;
  departamento_id: string | null;
  jefatura_ids: string[];
  jefaturas_nombres: string[];
  orden: number;
  activo: boolean;
  fecha: string | null;
  acreditaciones?: AcreditacionFile[];
  titular?: string | null;
};

export function departamentoTieneJefe(
  puestos: PuestoRecord[],
  departamentoId: string,
): boolean {
  return puestos.some(
    (p) =>
      p.departamento_id === departamentoId && p.jefatura_ids.length > 0,
  );
}

export function puestosEnDepartamento(
  puestos: PuestoRecord[],
  departamentoId: string,
): PuestoRecord[] {
  return puestos.filter((p) => p.departamento_id === departamentoId);
}

export function hijosDirectosDepartamento(
  departamentos: DepartamentoRecord[],
  departamentoId: string,
): DepartamentoRecord[] {
  return departamentos.filter(
    (d) => d.activo && d.parent_id === departamentoId,
  );
}

export function jefaturasPermitidas(
  departamentos: DepartamentoRecord[],
  departamentoId: string,
  jefaturaIds: string[],
): string[] {
  const permitidos = new Set(
    hijosDirectosDepartamento(departamentos, departamentoId).map((d) => d.id),
  );
  permitidos.add(departamentoId);
  return jefaturaIds.filter((id) => permitidos.has(id));
}

export function buscarNodoPorId(
  nodo: NodoOrganizacion,
  id: string,
): NodoOrganizacion | null {
  if (nodo.id === id) return nodo;
  for (const hijo of nodo.hijos ?? []) {
    const encontrado = buscarNodoPorId(hijo, id);
    if (encontrado) return encontrado;
  }
  return null;
}

export type ProfileOpcion = {
  id: string;
  nombre: string;
  email: string | null;
  puesto_id: string | null;
  puesto_nombre: string | null;
};

export const asignarPersonaSchema = z.object({
  puesto_id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
});

export type AsignarPersonaValues = z.infer<typeof asignarPersonaSchema>;

export const reubicarPuestoSchema = z.object({
  puesto_id: z.string().uuid(),
  departamento_id: z.string().uuid(),
});

export type ReubicarPuestoValues = z.infer<typeof reubicarPuestoSchema>;

export function rutaDepartamento(
  departamentos: DepartamentoRecord[],
  id: string,
): string {
  const porId = new Map(departamentos.map((d) => [d.id, d]));
  const partes: string[] = [];
  let actual = porId.get(id);
  while (actual) {
    partes.unshift(actual.nombre);
    actual = actual.parent_id ? porId.get(actual.parent_id) : undefined;
  }
  return partes.join(" › ");
}
