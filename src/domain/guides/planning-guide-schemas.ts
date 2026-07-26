import { z } from "zod";

const limitedTextList = z.array(z.string().trim().min(1).max(500)).max(20);

const guideStepSchema = z.object({
  localId: z.string().trim().min(3).max(80),
  position: z.number().int().min(0).max(29),
  phase: z.enum(["prepare", "build", "integrate", "verify", "handoff"]),
  title: z.string().trim().min(3).max(180),
  outcome: z.string().trim().min(5).max(1000),
  responsibleUserId: z.uuid(),
  responsibleName: z.string().trim().min(1).max(160),
  effortShare: z.number().int().min(1).max(100),
  verification: z.string().trim().min(5).max(1000),
  dependencies: limitedTextList,
  risks: limitedTextList,
  sourceKind: z.enum([
    "ticket",
    "unknown",
    "dependency",
    "subtask",
    "requirement",
    "criterion",
    "outcome",
    "manual",
  ]),
  sourceLabel: z.string().trim().min(1).max(500),
});

export const planningGuideSchema = z
  .object({
    ticketId: z.uuid(),
    estimateId: z.uuid(),
    assignmentPlanId: z.uuid(),
    objective: z.string().trim().min(8).max(2000),
    sequenceRationale: z.string().trim().min(12).max(3000),
    verificationStrategy: z.string().trim().min(8).max(3000),
    estimateRange: z.object({
      low: z.number().positive().max(100000),
      high: z.number().positive().max(100000),
      unit: z.enum(["hours", "days", "points"]),
    }),
    steps: z.array(guideStepSchema).min(3).max(30),
    assumptions: limitedTextList,
    evidenceLimitations: limitedTextList,
    engineKind: z.literal("local_rules"),
    engineVersion: z.literal("tr-guide-1"),
  })
  .superRefine((guide, context) => {
    if (guide.estimateRange.low >= guide.estimateRange.high) {
      context.addIssue({
        code: "custom",
        path: ["estimateRange"],
        message: "La guía debe conservar el rango confirmado.",
      });
    }

    if (
      guide.steps.reduce((total, step) => total + step.effortShare, 0) !== 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "La distribución de esfuerzo debe sumar 100%.",
      });
    }

    if (
      new Set(guide.steps.map((step) => step.localId)).size !==
      guide.steps.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Cada paso necesita un identificador único.",
      });
    }
  });

export const confirmPlanningGuideSchema = z.object({
  ticketId: z.uuid(),
  guide: planningGuideSchema,
});

