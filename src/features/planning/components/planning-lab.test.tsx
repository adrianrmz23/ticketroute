import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { calculateEstimate } from "@/application/planning/calculate-estimate";
import { organizeCaptureLocally } from "@/application/tickets/organize-capture";

import { PlanningLab } from "./planning-lab";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/planning/actions", () => ({
  saveEstimateAction: vi.fn(),
}));

describe("PlanningLab", () => {
  it("presenta tres escenarios editables y explica que no son cifras exactas", () => {
    const ticket = organizeCaptureLocally(
      "Necesitamos agregar inicio de sesión con Google antes del viernes.",
      "plan",
    );
    const proposal = calculateEstimate({
      ticket,
      unit: "days",
      weeklyCapacityHours: 40,
    });

    render(
      <PlanningLab
        ticketId="404f8a7c-3d5b-4c47-8e19-f86d0748c483"
        ticketTitle={ticket.title}
        ticketStatus="Listo para planear"
        initialProposal={proposal}
        confirmedVersion={null}
        confirmedAt={null}
      />,
    );

    expect(screen.getByText("Favorable")).toBeInTheDocument();
    expect(screen.getByText("Probable")).toBeInTheDocument();
    expect(screen.getByText("Adverso")).toBeInTheDocument();
    expect(screen.getByLabelText("Probable desde")).toBeEnabled();
    expect(
      screen.getByText("Ningún escenario admite una cifra exacta."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirmar estimación/i }),
    ).toBeEnabled();
  });
});

