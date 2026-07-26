import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExecutionRun } from "@/domain/execution/execution";

import { ExecutionBoardDetail } from "./execution-board-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/execution/actions", () => ({
  startExecutionAction: vi.fn(),
  updateExecutionStepAction: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/browser", () => ({
  createSupabaseBrowserClient: () => {
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
      channel: () => channel,
      removeChannel: vi.fn(),
    };
  },
}));

const baseProps = {
  workspaceId: "00000000-0000-4000-8000-000000000012",
  ticketId: "10000000-0000-4000-8000-000000000012",
  ticketTitle: "Preparar integración de pagos",
  guideId: "20000000-0000-4000-8000-000000000012",
  guideVersion: 1,
  guideObjective: "Entregar una integración verificable y reversible.",
  rangeLabel: "3–5 días",
  guideStepCount: 2,
  guideTeamCount: 1,
  canManageAll: true,
  currentUserId: "30000000-0000-4000-8000-000000000012",
  capacityWarnings: [],
};

const run: ExecutionRun = {
  id: "40000000-0000-4000-8000-000000000012",
  ticketId: baseProps.ticketId,
  guideId: baseProps.guideId,
  guideVersion: 1,
  status: "active",
  startedAt: "2026-07-26T08:00:00Z",
  completedAt: null,
  steps: [
    {
      id: "50000000-0000-4000-8000-000000000012",
      guideStepId: "60000000-0000-4000-8000-000000000012",
      position: 0,
      phase: "build",
      title: "Construir integración",
      outcome: "Flujo principal funcional",
      responsibleUserId: baseProps.currentUserId,
      responsibleName: "Adrián",
      effortShare: 60,
      verification: "Prueba reproducible",
      dependencies: [],
      risks: [],
      sourceKind: "subtask",
      sourceLabel: "Implementar flujo",
      status: "in_progress",
      evidenceNote: "",
      blockerNote: "",
      startedAt: "2026-07-26T08:05:00Z",
      completedAt: null,
      updatedAt: "2026-07-26T08:05:00Z",
    },
    {
      id: "70000000-0000-4000-8000-000000000012",
      guideStepId: "80000000-0000-4000-8000-000000000012",
      position: 1,
      phase: "verify",
      title: "Comprobar criterios",
      outcome: "Criterios satisfechos",
      responsibleUserId: baseProps.currentUserId,
      responsibleName: "Adrián",
      effortShare: 40,
      verification: "Suite aprobada",
      dependencies: [],
      risks: [],
      sourceKind: "criterion",
      sourceLabel: "Criterios de aceptación",
      status: "done",
      evidenceNote: "La suite principal fue aprobada.",
      blockerNote: "",
      startedAt: "2026-07-26T08:05:00Z",
      completedAt: "2026-07-26T09:00:00Z",
      updatedAt: "2026-07-26T09:00:00Z",
    },
  ],
};

describe("ExecutionBoardDetail", () => {
  it("presenta activación explícita antes de copiar la guía", () => {
    render(<ExecutionBoardDetail {...baseProps} run={null} />);

    expect(
      screen.getByRole("heading", {
        name: "La guía está lista para convertirse en trabajo visible.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Iniciar recorrido" }),
    ).toBeEnabled();
    expect(screen.getByText("Sin actividad individual")).toBeInTheDocument();
  });

  it("muestra progreso, acciones y evidencia sin telemetría", () => {
    render(<ExecutionBoardDetail {...baseProps} run={run} />);

    expect(
      screen.getByRole("heading", {
        name: "Ejecutar con evidencia, no con vigilancia.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("40%")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Completar" })).toBeEnabled();
    expect(screen.getByText("La suite principal fue aprobada.")).toBeInTheDocument();
    expect(
      screen.getByText(/No se observa conexión, presencia/),
    ).toBeInTheDocument();
  });
});
