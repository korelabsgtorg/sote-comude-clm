import { z } from 'zod';
import type { ArchivoAdjunto, ActMiembro } from '@/components/tareas/types';

export interface AgendaConcejo {
  id: string;
  created_at: string;
  fecha_reunion: string;
  titulo: string;
  descripcion: string;
  estado: string;
  acta?: string | null;
  libro?: string;
  user_id?: string;
  inicio?: string | null;
  fin?: string | null;
}

export interface AgendaFormData {
  titulo: string;
  descripcion: string;
  fecha_reunion: string;
  hora_reunion: string;
  acta?: string | null;
  libro: string;
  estado: string;
}

export interface CategoriaItem {
  id: string;
  nombre: string;
}

export interface UsuarioAsignable {
  user_id: string;
  nombre: string;
  activo?: boolean;
}

export interface ActividadConcejo {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  assigned_to: string | null;
  confirmed_at: string | null;
  updated_at?: string | null;
  assignee_nombre: string;
  checklist?: { title: string; is_completed: boolean }[] | null;
  archivos?: ArchivoAdjunto[] | null;
  created_at?: string;
  miembros?: ActMiembro[];
  revisado_por?: { nombre: string; fecha: string } | null;
}

export interface ActividadConcejoConContexto extends ActividadConcejo {
  punto_id: string;
  punto_titulo: string;
  agenda_id: string;
  agenda_titulo: string;
  agenda_fecha: string;
  agenda_estado: string;
  agenda_descripcion: string;
}

export interface Tarea {
  id: string;
  agenda_concejo_id?: string;
  titulo_item: string;
  descripcion?: string;
  estado: string;
  votacion: string | null;
  notas: string[] | null;
  seguimiento: string[] | null;
  fecha_vencimiento?: string;
  categoria_id?: string;
  categoria?: CategoriaItem;
  actividades?: ActividadConcejo[];
  total_documentos?: number;
}

export const sesionSchema = z.object({
  titulo: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  acta: z.string().optional().nullable(),
  libro: z.string().min(1, 'El número de libro es requerido.'),
  descripcion: z.string().optional(),
  fecha_reunion: z.string().min(1, 'La fecha es requerida.'),
  hora_reunion: z.string().min(1, 'La hora es requerida.'),
  estado: z.string().optional(),
});

export type SesionFormData = z.infer<typeof sesionSchema>;

export const tareaSchema = z.object({
  titulo_item: z.string().min(3, { message: 'El título de la tarea es obligatorio y debe tener al menos 3 caracteres.' }),
  categoria_id: z.string().uuid({ message: 'Debe seleccionar una categoría válida.' }),
  estado: z.string().min(1, { message: 'El estado es obligatorio.' }),
  notas: z.array(z.string()).optional().nullable(),
  seguimiento: z.array(z.string()).optional().nullable(),
  votacion: z.string().optional(),
});

export type TareaFormData = z.infer<typeof tareaSchema>;