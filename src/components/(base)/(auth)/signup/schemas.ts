import { z } from "zod";

export const authSchema = z.object({
  name: z.string().min(3, "El nombre es obligatorio").trim(),

  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+$/,
      "Solo letras minúsculas y números (sin espacios ni símbolos)",
    ),

  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[a-z]/, "Debe tener una minúscula")
    .regex(/[A-Z]/, "Debe tener una mayúscula")
    .regex(/[0-9]/, "Debe tener un número")
    .regex(/[^A-Za-z0-9]/, "Debe tener un símbolo (/!@#$...)"),

  rol: z.enum(
    ["cocode", "institucion", "admin", "super", "user"],
    {
      message: "Rol inválido",
    },
  ),

  organizacion_id: z
    .string()
    .uuid("Organización inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),

  municipio_id: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || !isNaN(val), {
      message: "Municipio inválido",
    }),
});

export type AuthInput = z.infer<typeof authSchema>;
