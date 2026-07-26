import { z } from "zod";

const participantSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().trim().min(1).max(160),
  participationRole: z.enum(["responsible", "collaborator"]),
  contributionPercent: z.number().int().min(1).max(100),
  reason: z.string().trim().min(3).max(500),
});

const evidenceSchema = z.object({
  signal: z.string().trim().min(2).max(120),
  status: z.enum(["used", "missing", "excluded"]),
  detail: z.string().trim().min(3).max(500),
});

export const assignmentScenarioSchema = z
  .object({
    strategy: z.enum([
      "fast_delivery",
      "balanced_load",
      "knowledge_transfer",
      "custom",
    ]),
    label: z.string().trim().min(3).max(80),
    summary: z.string().trim().min(3).max(500),
    estimateId: z.uuid(),
    range: z.object({
      low: z.number().positive().max(100000),
      high: z.number().positive().max(100000),
      unit: z.enum(["hours", "days", "points"]),
    }),
    confidence: z.enum(["low", "medium", "high"]),
    participants: z.array(participantSchema).min(1).max(20),
    resultingLoad: z.object({
      level: z.enum(["low", "medium", "high", "overloaded"]),
      percentage: z.number().min(0).max(1000).nullable(),
      label: z.string().trim().min(2).max(120),
      basis: z.string().trim().min(3).max(500),
    }),
    knowledgeConcentration: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(12).max(4000),
    risks: z.array(z.string().trim().min(1).max(500)).max(30),
    discardedAlternatives: z
      .array(z.string().trim().min(1).max(500))
      .max(30),
    changeConsequence: z.string().trim().min(8).max(1000),
    evidence: z.array(evidenceSchema).min(1).max(30),
    evidenceLimitations: z
      .array(z.string().trim().min(1).max(500))
      .max(30),
    engineKind: z.literal("local_rules"),
    engineVersion: z.literal("tr-assignment-2"),
  })
  .superRefine((scenario, context) => {
    if (scenario.range.low >= scenario.range.high) {
      context.addIssue({
        code: "custom",
        path: ["range"],
        message: "La asignación debe conservar un rango, no una cifra exacta.",
      });
    }

    const responsible = scenario.participants.filter(
      (participant) => participant.participationRole === "responsible",
    );
    if (responsible.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Selecciona exactamente una persona responsable.",
      });
    }

    if (
      new Set(scenario.participants.map((participant) => participant.userId))
        .size !== scenario.participants.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Una persona no puede ocupar dos lugares en el mismo plan.",
      });
    }

    if (
      scenario.participants.reduce(
        (total, participant) => total + participant.contributionPercent,
        0,
      ) !== 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "La contribución del equipo debe sumar 100%.",
      });
    }
  });

export const confirmAssignmentSchema = z.object({
  ticketId: z.uuid(),
  scenario: assignmentScenarioSchema,
});
