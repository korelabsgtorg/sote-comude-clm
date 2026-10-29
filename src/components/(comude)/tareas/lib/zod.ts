import { z } from "zod";

// ==============================================================================
// 1. Constantes y Estados del Módulo de Tareas
// ==============================================================================

export const ESTADOS_TAREA = {
  ASIGNADO: "Asignado",
  EN_PROCESO: "En Proceso",
  COMPLETADO: "Completado",
} as const;

export type EstadoTarea = (typeof ESTADOS_TAREA)[keyof typeof ESTADOS_TAREA];

export const ETIQUETAS_ESTADO: Record<string, string> = {
  ASIGNADO: "Asignado",
  EN_PROCESO: "En Proceso",
  COMPLETADO: "Completado",
  Asignado: "Asignado",
  "En Proceso": "En Proceso",
  Completado: "Completado",
};

export function normalizarEstado(estado: string | null | undefined): EstadoTarea | null {
  if (!estado) return null;
  const e = estado.trim().toLowerCase().replace('_', ' ');
  if (e === 'completado' || e === 'completada') return ESTADOS_TAREA.COMPLETADO;
  if (e === 'en proceso') return ESTADOS_TAREA.EN_PROCESO;
  if (e === 'asignado' || e === 'asignada') return ESTADOS_TAREA.ASIGNADO;
  return null;
}

export const REMITENTE_COMUDE = "El COMUDE";

export const RUTAS_TAREAS = {
  mis_actividades: "/comude/actividades",
  gestion_jefe: "/comude/actividades/jefatura",
  gestion_rrhh: "/comude/actividades/supervision",
} as const;

export const BUCKET_ARCHIVOS_TAREAS = "archivos_tareas";

export type TipoVistaTareas = "mis_actividades" | "gestion_jefe" | "gestion_rrhh";

// ==============================================================================
// 2. Esquemas Zod y Tipos de Entidades
// ==============================================================================

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio"),
  is_completed: z.boolean().default(false),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const asignacionMiembroSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio"),
  is_complete: z.boolean().default(false),
});
export type AsignacionMiembro = z.infer<typeof asignacionMiembroSchema>;

export const archivoAdjuntoSchema = z.object({
  id: z.string().uuid(),
  tipo: z.enum(["pdf", "enlace"]),
  nombre: z.string().min(1),
  url: z.string().min(1),
  ruta_storage: z.string().optional(),
  cargado_por: z.string().optional(),
});
export type ArchivoAdjunto = z.infer<typeof archivoAdjuntoSchema>;

// Esquema de entrada para crear una nueva actividad
export const newTaskSchema = z.object({
  title: z.string().trim().min(1, "El título de la actividad es requerido"),
  description: z.string().nullable().optional(),
  due_date: z.string().min(1, "La fecha límite es requerida"),
  assigned_to: z.string().uuid("Debe seleccionar un usuario válido"),
  checklist: z.array(checklistItemSchema).default([]),
  status: z.string().optional(),
  miembros: z
    .array(
      z.object({
        userId: z.string().uuid(),
        asignaciones: z.array(asignacionMiembroSchema),
      })
    )
    .optional(),
  punto_comude_id: z.string().uuid().nullable().optional(),
  comision_id: z.string().uuid().nullable().optional(),
});
export type NewTaskState = z.infer<typeof newTaskSchema>;

export const actualizarTareaSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  assigned_to: z.string().uuid().optional(),
});
export type ActualizarTareaInput = z.infer<typeof actualizarTareaSchema>;

// ==============================================================================
// 3. Tipos para UI, Perfiles y Agrupaciones
// ==============================================================================

export interface OficinaInfo {
  id: string;
  nombre: string;
}

export interface PerfilUsuario {
  id: string;
  nombre: string;
  rol: string | null;
  esJefe: boolean;
  esSupervisor: boolean;
  municipioId: number | null;
  oficinasACargo: OficinaInfo[];
}

export interface Usuario {
  user_id: string;
  nombre: string;
  esjefe: boolean;
  activo: boolean;
  oficina_nombre?: string | null;
  dependencia_id?: string | null;
  puesto_nombre?: string | null;
  rol?: string | null;
}

export interface ActMiembro {
  id: string;
  id_act: string;
  id_user: string;
  asignaciones: AsignacionMiembro[];
  completed_at: string | null;
  confirmed_at?: string | null;
  comentario: string | null;
  created_at: string;
  nombre_usuario?: string;
}

export interface Tarea {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: EstadoTarea | string;
  checklist: ChecklistItem[] | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  confirmed_at: string | null;
  archivos: ArchivoAdjunto[] | null;
  revisado_por?: { nombre: string; fecha: string } | null;
  municipio_id?: number;

  assignee?: {
    nombre: string;
    oficina_nombre?: string;
  };
  creator?: { nombre: string };
  miembros?: ActMiembro[];

  estadoFiltro?: string;
  alcance?: "equipo" | "externa";
  es_concejo?: boolean;
  punto_id?: string;
  punto_titulo?: string;
  agenda_id?: string;
  agenda_titulo?: string;
  agenda_fecha?: string;
  comision_id?: string;
  comision_nombre?: string;
}

export interface ActividadPendiente {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  created_by: string;
  assigned_to: string;
  creador_nombre: string;
  es_concejo?: boolean;
  punto_titulo?: string | null;
  agenda_titulo?: string | null;
  rol_confirmacion?: "encargado" | "miembro";
  id_miembro?: string | null;
}

// Aliases para terminología unificada de Actividad
export type Actividad = Tarea;
export const ESTADOS_ACTIVIDAD = ESTADOS_TAREA;
export type EstadoActividad = EstadoTarea;
export const RUTAS_ACTIVIDADES = RUTAS_TAREAS;
export type TipoVistaActividades = TipoVistaTareas;
export type ActualizarActividadInput = ActualizarTareaInput;
export type NewActividadState = NewTaskState;
