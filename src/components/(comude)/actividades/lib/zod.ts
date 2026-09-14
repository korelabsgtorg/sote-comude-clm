import { z } from "zod";

// ----- Tipos de la Base de Datos -----
export type ActComude = {
  id: string;
  fecha: string; // timestamptz
  created_at: string;
  img: string[] | null;
  municipio_id: number | null;
  estado: string | null;
  inicio: string | null;
  fin: string | null;
  descripcion: string | null;
  detalles_sesion: {
    titulo: string;
    acta?: string;
    libro?: string;
  } | null;
  acta?: string[] | null;
  actas?: any;
  agenda?: any[] | null;
};

export type ActComudeParticipante = {
  act_comude_id: string;
  usuario_id: string;
  encargado: boolean;
};

export type ActComudeRegistro = {
  id: string;
  act_comude_id: string;
  usuario_id: string;
  tipo_registro: "entrada" | "salida";
  ubicacion: any;
  notas: string | null;
  created_at: string;
};

// ----- Tipos de la nueva estructura de Puntos de Agenda -----

export type ActComudeCategoria = {
  id: string;
  nombre: string;
  created_at: string;
  municipio_id?: number | null;
};

export type ActComudeArchivo = {
  id: string;
  punto_id: string;
  nombre: string;
  file_path: string;
  created_at: string;
};

export type ActComudePunto = {
  id: string;
  act_comude_id: string;
  categoria_id: string | null;
  titulo: string;
  estado: string | null;
  votacion: string | null;
  notas: string[] | null;
  orden: number;
  created_at: string;
  // Relaciones opcionales
  categoria?: ActComudeCategoria;
  act_comude_archivos?: ActComudeArchivo[];
};

export type ActComudeConParticipantes = ActComude & {
  act_comude_participantes: (ActComudeParticipante & {
    profiles?: { nombre: string; rol: string } | null;
  })[];
  act_comude_puntos?: ActComudePunto[];
};

// ----- Zod Schemas -----

export const crearActividadSchema = z.object({
  titulo: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  fecha: z.string().min(1, "La fecha es requerida"),
  acta: z.string().optional(),
  libro: z.string().optional(),
  descripcion: z.string().optional(),
  participantes: z.array(
    z.object({
      usuario_id: z.string(),
      encargado: z.boolean(),
    })
  ).default([]),
});

export const registroAsistenciaSchema = z.object({
  act_comude_id: z.string().uuid("ID de actividad inválido"),
  tipo_registro: z.enum(["entrada", "salida"]),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  notas: z.string().optional(),
});

// ----- Schemas para Puntos de Agenda -----
export const crearPuntoSchema = z.object({
  titulo: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  categoria_id: z.string().uuid("Debe seleccionar una categoría válida").optional().nullable(),
  estado: z.string().optional().nullable(),
  votacion: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  orden: z.number().optional().nullable(),
});

export type CrearActividadValues = z.infer<typeof crearActividadSchema>;
export type RegistroAsistenciaValues = z.infer<typeof registroAsistenciaSchema>;
export type CrearPuntoValues = z.infer<typeof crearPuntoSchema>;
