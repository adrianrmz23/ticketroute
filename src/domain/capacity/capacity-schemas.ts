import { z } from "zod";

const declaredListSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(20)
  .transform((items) =>
    [...new Set(items.map((item) => item.replace(/\s+/g, " ").trim()))].filter(
      Boolean,
    ),
  );

export const planningProfileSchema = z
  .object({
    workspaceId: z.uuid(),
    userId: z.uuid(),
    availabilityHours: z.number().min(1).max(168).nullable(),
    plannedHours: z.number().min(0).max(168),
    skills: declaredListSchema,
    componentExperience: declaredListSchema,
    technicalOwnership: declaredListSchema,
    learningGoals: declaredListSchema,
  })
  .superRefine((profile, context) => {
    if (
      profile.availabilityHours !== null &&
      profile.plannedHours > profile.availabilityHours * 2
    ) {
      context.addIssue({
        code: "custom",
        path: ["plannedHours"],
        message:
          "Las horas planeadas no pueden superar el doble de la disponibilidad declarada.",
      });
    }
  });

export function parseDeclaredList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

