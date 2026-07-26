import { z } from "zod";

export const startExecutionSchema = z.object({
  ticketId: z.uuid(),
  guideId: z.uuid(),
});

export const updateExecutionStepSchema = z
  .object({
    ticketId: z.uuid(),
    executionStepId: z.uuid(),
    status: z.enum([
      "pending",
      "in_progress",
      "blocked",
      "done",
      "skipped",
    ]),
    evidenceNote: z.string().trim().max(2000),
    blockerNote: z.string().trim().max(2000),
  })
  .superRefine((input, context) => {
    if (
      ["done", "skipped"].includes(input.status) &&
      input.evidenceNote.length < 5
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceNote"],
        message:
          input.status === "done"
            ? "Describe la evidencia antes de completar."
            : "Explica por qué se omite el paso.",
      });
    }

    if (input.status === "blocked" && input.blockerNote.length < 5) {
      context.addIssue({
        code: "custom",
        path: ["blockerNote"],
        message: "Describe el bloqueo antes de registrarlo.",
      });
    }
  });
