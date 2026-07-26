import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { generateAssignmentScenarios } from "@/application/assignment/generate-assignment-scenarios";
import type { AssignmentCandidate } from "@/domain/assignment/assignment";

import { AssignmentStudio } from "./assignment-studio";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/assignment/actions", () => ({
  confirmAssignmentAction: vi.fn(),
}));

const candidates: AssignmentCandidate[] = [
  {
    userId: "10000000-0000-4000-8000-000000000001",
    displayName: "Adrián",
    role: "owner",
    joinedAt: "2026-07-01T00:00:00Z",
    activeAssignmentCount: 1,
    priorParticipation: true,
  },
  {
    userId: "10000000-0000-4000-8000-000000000002",
    displayName: "Sofía",
    role: "planner",
    joinedAt: "2026-07-02T00:00:00Z",
    activeAssignmentCount: 0,
    priorParticipation: false,
  },
];

describe("AssignmentStudio", () => {
  it("compara cuatro rutas y muestra la frontera de decisión", () => {
    const scenarios = generateAssignmentScenarios({
      estimate: {
        id: "20000000-0000-4000-8000-000000000001",
        unit: "days",
        confidence: "medium",
        favorable: { low: 2, high: 3 },
        probable: { low: 3, high: 5 },
        adverse: { low: 5, high: 7 },
      },
      candidates,
      weeklyCapacityHours: 40,
      dependencies: [],
    });

    render(
      <AssignmentStudio
        ticketId="30000000-0000-4000-8000-000000000001"
        ticketTitle="Integración de pagos"
        estimateVersion={1}
        weeklyCapacityHours={40}
        candidates={candidates}
        initialScenarios={scenarios}
        initialStrategy="balanced_load"
        rangeEnvelope={{ low: 2, high: 7 }}
        confirmedVersion={null}
        confirmedAt={null}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Entrega rápida/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Carga equilibrada/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Transferencia de conocimiento/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Personalizado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No se usan conexión, presencia/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirmar asignación/i }),
    ).toBeEnabled();
  });
});
