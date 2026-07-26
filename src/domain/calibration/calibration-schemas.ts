import { z } from "zod";

export function parseCalibrationList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export const calibrationRecordSchema = z.object({
  ticketId: z.uuid(),
  actualValue: z.number().positive().max(100000),
  interruptionCount: z.number().int().min(0).max(1000),
  scopeChanged: z.boolean(),
  unexpectedBlockers: z.array(z.string().trim().min(1).max(500)).max(30),
  unexpectedDependencies: z
    .array(z.string().trim().min(1).max(500))
    .max(30),
  deviationCause: z.string().trim().max(3000),
  selectedScenario: z.enum([
    "favorable",
    "probable",
    "adverse",
    "outside",
  ]),
  learningSummary: z.string().trim().max(3000),
  status: z.enum(["draft", "confirmed"]),
});
