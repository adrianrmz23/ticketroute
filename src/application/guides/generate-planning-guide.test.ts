import { describe, expect, it } from "vitest";

import type { TicketDraft } from "@/domain/tickets/ticket";

import { generatePlanningGuide } from "./generate-planning-guide";

const ticket: TicketDraft = {
  title: "Integrar pagos",
  objective: "Cobrar de forma segura",
  problem: "No existe integración",
  context: "Checkout disponible",
  expectedOutcome: "Pago aprobado y recuperable",
  scope: ["Checkout"],
  outOfScope: ["Suscripciones"],
  functionalRequirements: ["Crear pago"],
  technicalRequirements: ["Webhook idempotente"],
  constraints: ["PCI"],
  acceptanceCriteria: ["Pago aprobado", "Error recuperable"],
  risks: ["Duplicados"],
  assumptions: ["Proveedor activo"],
  unknowns: ["Política de reintentos"],
  dependencies: ["Proveedor"],
  labels: ["pagos"],
  priority: "high",
  targetDate: "",
  subtasks: ["Crear intención", "Procesar webhook"],
  status: "planned",
};

const input = {
  ticketId: "10000000-0000-4000-8000-000000000011",
  ticket,
  estimate: {
    id: "20000000-0000-4000-8000-000000000011",
    low: 3,
    high: 5,
    unit: "days" as const,
  },
  assignment: {
    id: "30000000-0000-4000-8000-000000000011",
    participants: [
      {
        userId: "40000000-0000-4000-8000-000000000011",
        displayName: "Adrián",
        participationRole: "responsible" as const,
        contributionPercent: 60,
      },
      {
        userId: "50000000-0000-4000-8000-000000000011",
        displayName: "Sofía",
        participationRole: "collaborator" as const,
        contributionPercent: 40,
      },
    ],
    evidenceLimitations: ["Disponibilidad sujeta a revisión."],
  },
};

describe("generatePlanningGuide", () => {
  it("construye un recorrido ordenado y verificable", () => {
    const guide = generatePlanningGuide(input);

    expect(guide.steps[0].phase).toBe("prepare");
    expect(guide.steps.at(-1)?.phase).toBe("handoff");
    expect(guide.steps.some((step) => step.phase === "verify")).toBe(true);
    expect(
      guide.steps.reduce((total, step) => total + step.effortShare, 0),
    ).toBe(100);
    expect(guide.engineVersion).toBe("tr-guide-1");
  });

  it("conserva fuente, responsable y verificación en todos los pasos", () => {
    const guide = generatePlanningGuide(input);

    expect(
      guide.steps.every(
        (step) =>
          step.sourceLabel &&
          step.responsibleUserId &&
          step.verification.length >= 5,
      ),
    ).toBe(true);
    expect(
      guide.steps.some((step) => step.responsibleName === "Sofía"),
    ).toBe(true);
  });

  it("declara límites sin convertir la guía en vigilancia", () => {
    const guide = generatePlanningGuide(input);

    expect(guide.evidenceLimitations.join(" ")).toContain(
      "no observa actividad",
    );
  });
});

