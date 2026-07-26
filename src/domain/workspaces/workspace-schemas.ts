import { z } from "zod";

const workspaceRole = z.enum([
  "owner",
  "admin",
  "planner",
  "member",
  "viewer",
]);

const workspaceId = z.uuid("El workspace no es válido");

export function createWorkspaceSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe al menos 2 caracteres")
    .max(80, "El nombre no puede superar 80 caracteres"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "La URL debe tener al menos 2 caracteres")
    .max(48, "La URL no puede superar 48 caracteres")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usa letras minúsculas, números y guiones intermedios",
    ),
  timezone: z
    .string()
    .trim()
    .min(1, "Selecciona una zona horaria")
    .max(80, "La zona horaria no es válida"),
  estimationUnit: z.enum(["hours", "days", "points"]),
  weeklyCapacityHours: z.coerce
    .number()
    .int("Usa horas completas")
    .min(1, "La capacidad debe ser mayor a cero")
    .max(168, "La capacidad no puede superar 168 horas"),
  defaultAiProvider: z.enum(["manual", "openai", "anthropic", "gemini"]),
  dataRetentionDays: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365), z.literal(730)])),
  deleteAudioAfterTranscription: z.boolean(),
});

export const selectWorkspaceSchema = z.object({ workspaceId });

export const createInviteSchema = z.object({
  workspaceId,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Escribe un correo válido")),
  role: workspaceRole.exclude(["owner"]),
});

export const revokeInviteSchema = z.object({
  inviteId: z.uuid("La invitación no es válida"),
});

export const changeMemberRoleSchema = z.object({
  workspaceId,
  userId: z.uuid("El miembro no es válido"),
  role: workspaceRole,
});

export const removeMemberSchema = z.object({
  workspaceId,
  userId: z.uuid("El miembro no es válido"),
});

export const invitationTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "La invitación no es válida");

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
