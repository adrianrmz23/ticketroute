import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Escribe un correo válido"));

const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede superar 72 caracteres")
  .regex(/[a-zA-Z]/, "Incluye al menos una letra")
  .regex(/[0-9]/, "Incluye al menos un número");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña"),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Escribe al menos 2 caracteres")
      .max(80, "El nombre no puede superar 80 caracteres"),
    email,
    password,
    confirmPassword: z.string(),
    next: z.string().optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export const confirmEmailSchema = z.object({
  email,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe contener exactamente 6 dígitos"),
  next: z.string().optional(),
});

export const resendCodeSchema = z.object({ email });
export const recoverPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });
