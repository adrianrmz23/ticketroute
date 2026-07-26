import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlanningGuide } from "@/domain/guides/planning-guide";

import { PlanningGuideEditor } from "./planning-guide-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/guides/actions", () => ({
  confirmPlanningGuideAction: vi.fn(),
}));

const guide: PlanningGuide = {
  ticketId: "10000000-0000-4000-8000-000000000011",
  estimateId: "20000000-0000-4000-8000-000000000011",
  assignmentPlanId: "30000000-0000-4000-8000-000000000011",
  objective: "Entregar un resultado verificable",
  sequenceRationale:
    "Primero se prepara, después se construye y al final se verifica.",
  verificationStrategy: "Cada paso conserva una comprobación reproducible.",
  estimateRange: { low: 3, high: 5, unit: "days" },
  steps: [
    {
      localId: "step-1",
      position: 0,
      phase: "prepare",
      title: "Preparar alcance",
      outcome: "Alcance acordado",
      responsibleUserId: "40000000-0000-4000-8000-000000000011",
      responsibleName: "Adrián",
      effortShare: 20,
      verification: "Límites revisados",
      dependencies: [],
      risks: [],
      sourceKind: "ticket",
      sourceLabel: "Alcance",
    },
    {
      localId: "step-2",
      position: 1,
      phase: "build",
      title: "Construir cambio",
      outcome: "Cambio funcional",
      responsibleUserId: "40000000-0000-4000-8000-000000000011",
      responsibleName: "Adrián",
      effortShare: 55,
      verification: "Caso principal demostrado",
      dependencies: [],
      risks: [],
      sourceKind: "subtask",
      sourceLabel: "Implementar",
    },
    {
      localId: "step-3",
      position: 2,
      phase: "verify",
      title: "Verificar resultado",
      outcome: "Resultado comprobado",
      responsibleUserId: "50000000-0000-4000-8000-000000000011",
      responsibleName: "Sofía",
      effortShare: 25,
      verification: "Criterio reproducido",
      dependencies: [],
      risks: [],
      sourceKind: "criterion",
      sourceLabel: "Criterio",
    },
  ],
  assumptions: [],
  evidenceLimitations: ["No observa actividad individual."],
  engineKind: "local_rules",
  engineVersion: "tr-guide-1",
};

const props = {
  ticketId: guide.ticketId,
  ticketTitle: "Integrar pagos",
  assignmentVersion: 1,
  candidates: [
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
  initialGuide: guide,
  generatedGuide: guide,
  confirmedVersion: null,
  confirmedGuideId: null,
  confirmedAt: null,
  sourcesChanged: false,
};

describe("PlanningGuideEditor", () => {
  it("presenta pasos, responsables y contrato verificable", () => {
    render(<PlanningGuideEditor {...props} />);

    expect(
      screen.getByRole("heading", {
        name: "Convertir decisiones en un recorrido ejecutable.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Distribución completa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sofía · Colaborador · 40%")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar guía" }),
    ).toBeEnabled();
  });

  it("bloquea confirmación si el esfuerzo deja de sumar cien", () => {
    render(<PlanningGuideEditor {...props} />);

    fireEvent.change(screen.getByLabelText("Esfuerzo del paso 1"), {
      target: { value: "19" },
    });

    expect(
      screen.getByRole("button", { name: "Confirmar guía" }),
    ).toBeDisabled();
    expect(screen.getByText("99% de 100%")).toBeInTheDocument();
  });

  it("agrega un paso manual conservando la distribución total", () => {
    render(<PlanningGuideEditor {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar paso" }));

    expect(
      screen.getByDisplayValue("Nuevo paso verificable"),
    ).toBeInTheDocument();
    expect(screen.getByText("100% de 100%")).toBeInTheDocument();
  });
});
