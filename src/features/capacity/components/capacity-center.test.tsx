import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CapacityMember } from "@/domain/capacity/capacity";

import { CapacityCenter } from "./capacity-center";

vi.mock("@/features/capacity/actions", () => ({
  savePlanningProfileAction: vi.fn(),
}));

const members: CapacityMember[] = [
  {
    userId: "10000000-0000-4000-8000-000000000001",
    displayName: "Adrián",
    email: "adrian@example.com",
    role: "owner",
    joinedAt: "2026-07-01T00:00:00Z",
    activeAssignmentCount: 1,
    profile: {
      workspaceId: "20000000-0000-4000-8000-000000000001",
      userId: "10000000-0000-4000-8000-000000000001",
      availabilityHours: 40,
      plannedHours: 20,
      skills: ["React"],
      componentExperience: ["Checkout"],
      technicalOwnership: ["Frontend"],
      learningGoals: ["RLS"],
      updatedAt: "2026-07-26T00:00:00Z",
    },
  },
];

describe("CapacityCenter", () => {
  it("muestra capacidad y señales como declaraciones editables", () => {
    render(
      <CapacityCenter
        workspaceId="20000000-0000-4000-8000-000000000001"
        workspaceName="TicketRoute Lab"
        fallbackWeeklyHours={40}
        actorId={members[0].userId}
        actorRole="owner"
        members={members}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Planear capacidad, no vigilar personas.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("React")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar declaración" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin presencia, conexión ni velocidad")).toBeInTheDocument();
  });
});

