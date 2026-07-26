import { z } from "zod";

export const captureModeSchema = z.enum([
  "plan",
  "command",
  "standup",
  "meeting",
  "note",
]);

export const captureSourceSchema = z.enum([
  "manual",
  "dictation",
  "meeting_transcript",
  "import",
]);

export const saveCaptureSchema = z
  .object({
    id: z.uuid("La captura no es válida"),
    workspaceId: z.uuid("El workspace no es válido"),
    mode: captureModeSchema,
    source: captureSourceSchema,
    inputText: z
      .string()
      .max(20000, "La captura no puede superar 20,000 caracteres"),
    status: z.enum(["draft", "ready"]),
  })
  .superRefine((value, context) => {
    if (value.status === "ready" && value.inputText.trim().length < 12) {
      context.addIssue({
        code: "custom",
        path: ["inputText"],
        message: "Agrega un poco más de contexto antes de continuar",
      });
    }
  });

export const archiveCaptureSchema = z.object({
  id: z.uuid("La captura no es válida"),
});

export const captureConsentSchema = z.object({
  workspaceId: z.uuid("El workspace no es válido"),
  captureId: z.uuid("La captura no es válida").nullable(),
  decision: z.enum(["granted", "denied", "revoked"]),
});

export type SaveCaptureInput = z.infer<typeof saveCaptureSchema>;
