import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeamManagement } from "./team-management";

vi.mock("@/features/workspaces/actions", () => ({
  createInviteAction: vi.fn(async () => ({
    status: "idle",
    message: "",
  })),
  changeMemberRoleAction: vi.fn(async () => ({
    status: "idle",
    message: "",
  })),
  removeMemberAction: vi.fn(async () => ({
    status: "idle",
    message: "",
  })),
  revokeInviteAction: vi.fn(async () => ({
    status: "idle",
    message: "",
  })),
}));

const member = {
  userId: "0ea39a2f-b1ca-49f8-bf19-5930bab33f91",
  displayName: "Adrián Ramírez",
  email: "adrian@example.com",
  role: "owner" as const,
  joinedAt: "2026-07-25T20:00:00.000Z",
};

describe("TeamManagement", () => {
  it("muestra controles de invitación al owner", () => {
    render(
      <TeamManagement
        workspaceId="404f8a7c-3d5b-4c47-8e19-f86d0748c483"
        workspaceName="TicketRoute Lab"
        actorId={member.userId}
        actorRole="owner"
        members={[member]}
        invites={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Preparar invitación" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Adrián Ramírez")).toBeInTheDocument();
    expect(
      screen.getByText("Sin invitaciones pendientes"),
    ).toBeInTheDocument();
  });

  it("mantiene el directorio en solo lectura para viewers", () => {
    render(
      <TeamManagement
        workspaceId="404f8a7c-3d5b-4c47-8e19-f86d0748c483"
        workspaceName="TicketRoute Lab"
        actorId={member.userId}
        actorRole="viewer"
        members={[{ ...member, role: "viewer" }]}
        invites={[]}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Preparar invitación" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
  });
});
