import { describe, expect, it } from "vitest";

import {
  calibrationRecordSchema,
  parseCalibrationList,
} from "./calibration-schemas";

describe("calibration contracts", () => {
  it("normaliza señales declaradas sin conservar entradas vacías", () => {
    expect(
      parseCalibrationList(" Dependencia A,\n\nBloqueo B, Dependencia A "),
    ).toEqual(["Dependencia A", "Bloqueo B", "Dependencia A"]);
  });

  it("acepta un resultado confirmado y limita valores extremos", () => {
    expect(
      calibrationRecordSchema.safeParse({
        ticketId: crypto.randomUUID(),
        actualValue: 4,
        interruptionCount: 1,
        scopeChanged: false,
        unexpectedBlockers: ["Acceso tardío"],
        unexpectedDependencies: [],
        deviationCause: "La dependencia llegó después.",
        selectedScenario: "probable",
        learningSummary: "Validar acceso al inicio.",
        status: "confirmed",
      }).success,
    ).toBe(true);
    expect(
      calibrationRecordSchema.safeParse({
        ticketId: crypto.randomUUID(),
        actualValue: -1,
        interruptionCount: 1001,
        scopeChanged: false,
        unexpectedBlockers: [],
        unexpectedDependencies: [],
        deviationCause: "",
        selectedScenario: "probable",
        learningSummary: "",
        status: "draft",
      }).success,
    ).toBe(false);
  });
});
