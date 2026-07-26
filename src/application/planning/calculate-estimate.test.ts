import { describe, expect, it } from "vitest";

import { organizeCaptureLocally } from "@/application/tickets/organize-capture";

import { calculateEstimate } from "./calculate-estimate";

describe("calculateEstimate", () => {
  it("produce tres rangos ordenados y nunca una cifra exacta", () => {
    const ticket = organizeCaptureLocally(
      "Necesitamos agregar inicio de sesión con Google antes del viernes. El frontend está listo.",
      "plan",
    );
    const estimate = calculateEstimate({
      ticket,
      unit: "days",
      weeklyCapacityHours: 40,
    });

    expect(estimate.scenarios.favorable.low).toBeLessThan(
      estimate.scenarios.favorable.high,
    );
    expect(estimate.scenarios.probable.low).toBeLessThan(
      estimate.scenarios.probable.high,
    );
    expect(estimate.scenarios.adverse.low).toBeLessThan(
      estimate.scenarios.adverse.high,
    );
    expect(estimate.scenarios.favorable.high).toBeLessThanOrEqual(
      estimate.scenarios.probable.high,
    );
    expect(estimate.scenarios.probable.high).toBeLessThanOrEqual(
      estimate.scenarios.adverse.high,
    );
  });

  it("reduce la confianza cuando aumentan incógnitas, riesgos y dependencias", () => {
    const complete = organizeCaptureLocally(
      "Crear un formulario para el equipo antes del viernes.",
      "command",
    );
    complete.unknowns = [];
    complete.risks = [];
    complete.dependencies = [];

    const uncertain = {
      ...complete,
      unknowns: ["Definir alcance", "Confirmar usuarios"],
      risks: ["Migración", "Compatibilidad", "Seguridad"],
      dependencies: ["API", "Proveedor"],
    };

    const high = calculateEstimate({
      ticket: complete,
      unit: "days",
      weeklyCapacityHours: 40,
      historicalReferences: [{ label: "AUTH-011", low: 3, high: 5 }],
    });
    const low = calculateEstimate({
      ticket: uncertain,
      unit: "days",
      weeklyCapacityHours: 40,
    });

    expect(high.confidence).toBe("high");
    expect(low.confidence).toBe("low");
  });

  it("descompone el trabajo en un total verificable de 100%", () => {
    const ticket = organizeCaptureLocally(
      "Agregar exportación de tickets para administradores.",
      "plan",
    );
    const estimate = calculateEstimate({
      ticket,
      unit: "points",
      weeklyCapacityHours: 32,
    });

    expect(
      estimate.decomposition.reduce(
        (total, item) => total + item.effortShare,
        0,
      ),
    ).toBe(100);
  });
});
