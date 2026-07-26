import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CommandCenterPage from "./page";

vi.mock("@/application/workspaces/get-workspace-context", () => ({
  getWorkspaceContext: vi.fn(async () => ({
    currentWorkspace: {
      name: "TicketRoute Lab",
      weeklyCapacityHours: 40,
    },
  })),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(async () => ({ data: [], error: null })),
      then: (
        resolve: (value: { count: number; data: never[]; error: null }) => void,
      ) => resolve({ count: 0, data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);

    return {
      from: vi.fn(() => query),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    };
  }),
}));

describe("CommandCenterPage", () => {
  it("presenta el workspace sin inventar datos operativos", async () => {
    render(await CommandCenterPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Command Center" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin solicitudes")).toBeInTheDocument();
    expect(screen.getByText("Fallback 40h por persona")).toBeInTheDocument();
    expect(
      screen.getByText("Aún no hay estimaciones confirmadas"),
    ).toBeInTheDocument();
  });
});
