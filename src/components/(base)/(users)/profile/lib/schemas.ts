import { z } from "zod";

const numericString = (min: number, name: string) =>
  z
    .string()
    .length(min, `${name} debe tener ${min} dígitos`)
    .regex(/^\d+$/, `${name} solo debe contener números`);

const baseFields = z.object({
  nombre: z.string().min(2, "El nombre es requerido (min 2 letras)"),
  email: z.string().email("Ingresa un correo válido").optional(), // El email personal de contacto, distinto al del login

  telefono: numericString(8, "El teléfono"),
  dpi: numericString(13, "El DPI").optional().or(z.literal("")),
  nit: z.string().optional(),

  direccion: z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  genero: z.enum(["Masculino", "Femenino"]).optional(),
  contacto_emergencia: z.string().optional(),

  telefono_emergencia: z
    .string()
    .refine((val) => !val || /^\d{8,}$/.test(val), {
      message: "Tel. Emergencia inválido (mínimo 8 números)",
    })
    .optional(),
  rol: z
    .enum(["comude", "cocode", "institucion", "admin", "super", "user"])
    .optional(),
  organizacion_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .or(z.literal("")),
  municipio_id: z.union([z.string(), z.number()]).nullable().optional().or(z.literal("")),
  // --- CAMBIOS AQUÍ ---
  username: z
    .string()
    .min(4, "Usuario muy corto (min 4)")
    .regex(
      /^[a-z0-9]+$/,
      "Solo letras minúsculas y números (sin espacios ni símbolos)",
    )
    .optional()
    .or(z.literal("")),
});

// 2. Exportamos el objeto para validación parcial
export const profileObjectSchema = baseFields.extend({
  // No validamos password aquí directamente para permitir actualizaciones parciales
  password: z.string().optional(),

  // Validacion estricta de contraseña
  newPassword: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val) return true;
      return val.length >= 8;
    }, "Mínimo 8 caracteres")
    .refine((val) => {
      if (!val) return true;
      return /[A-Z]/.test(val);
    }, "Debe contener una mayúscula")
    .refine((val) => {
      if (!val) return true;
      return /[a-z]/.test(val);
    }, "Debe contener una minúscula")
    .refine((val) => {
      if (!val) return true;
      return /[0-9]/.test(val);
    }, "Debe contener un número")
    .refine((val) => {
      if (!val) return true;
      return /[^A-Za-z0-9]/.test(val);
    }, "Debe contener un símbolo (!@#/$...)"),

  confirmPassword: z.string().optional(),
});

// 3. Exportamos el esquema con validación cruzada
export const profileSchema = profileObjectSchema.refine(
  (data) => {
    if (data.newPassword && data.newPassword !== data.confirmPassword) {
      return false;
    }
    return true;
  },
  {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  },
);

export type ProfileFormValues = z.infer<typeof profileSchema>;
