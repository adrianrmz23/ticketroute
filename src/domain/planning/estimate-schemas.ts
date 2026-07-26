import { z } from "zod";

const rangeSchema = z
  .object({
    low: z.number().positive().max(100000),
    high: z.number().positive().max(100000),
  })
  .refine((range) => range.low < range.high, {
    message: "Cada escenario debe conservar un rango, no una cifra exacta.",
  });

const scenarioSchema = rangeSchema.extend({
  key: z.enum(["favorable", "probable", "adverse"]),
  label: z.string().trim().min(2).max(40),
  explanation: z.string().trim().min(3).max(500),
});

const cleanList = z.array(z.string().trim().min(1).max(500)).max(30);

export const estimateProposalSchema = z
  .object({
    unit: z.enum(["hours", "days", "points"]),
    scenarios: z.object({
      favorable: scenarioSchema,
      probable: scenarioSchema,
      adverse: scenarioSchema,
    }),
    confidence: z.enum(["low", "medium", "high"]),
    basis: z.string().trim().min(12).max(4000),
    decomposition: z
      .array(
        z.object({
          label: z.string().trim().min(2).max(120),
          effortShare: z.number().int().min(0).max(100),
          basis: z.string().trim().min(3).max(500),
        }),
      )
      .min(1)
      .max(12)
      .refine(
        (items) =>
          items.reduce((total, item) => total + item.effortShare, 0) === 100,
        { message: "La descomposición debe sumar 100%." },
      ),
    assumptions: cleanList,
    unknowns: cleanList,
    risks: cleanList,
    dependencies: cleanList,
    historicalReferences: cleanList,
    factors: z
      .array(
        z.object({
          key: z.string().trim().min(2).max(80),
          label: z.string().trim().min(2).max(120),
          direction: z.enum(["increases", "decreases", "neutral"]),
          weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          evidence: z.string().trim().min(3).max(500),
        }),
      )
      .min(1)
      .max(20),
    calculationSnapshot: z.object({
      complexityScore: z.number().nonnegative().max(100000),
      capacityHoursPerWeek: z.number().positive().max(168),
      comparableCount: z.number().int().nonnegative().max(10000),
    }),
    engineKind: z.literal("local_rules"),
    engineVersion: z.literal("tr-estimate-1"),
  })
  .superRefine((proposal, context) => {
    const { favorable, probable, adverse } = proposal.scenarios;

    if (
      favorable.low > probable.low ||
      probable.low > adverse.low ||
      favorable.high > probable.high ||
      probable.high > adverse.high
    ) {
      context.addIssue({
        code: "custom",
        path: ["scenarios"],
        message:
          "Los escenarios deben avanzar de favorable a probable y adverso.",
      });
    }
  });

export const saveEstimateSchema = z.object({
  ticketId: z.uuid(),
  proposal: estimateProposalSchema,
});

