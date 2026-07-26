import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

describe("AppShell", () => {
  const shellProps = {
    viewer: {
      displayName: "Adrián Ramírez",
      email: "adrian@example.com",
      initials: "AR",
    },
    currentWorkspace: {
      id: "404f8a7c-3d5b-4c47-8e19-f86d0748c483",
      name: "TicketRoute Lab",
      slug: "ticketroute-lab",
      role: "owner" as const,
      timezone: "America/Mexico_City",
      estimationUnit: "days" as const,
      weeklyCapacityHours: 40,
      defaultAiProvider: "manual" as const,
      dataRetentionDays: 365 as const,
      deleteAudioAfterTranscription: true,
      joinedAt: "2026-07-25T20:00:00.000Z",
    },
    availableWorkspaces: [
      {
        id: "404f8a7c-3d5b-4c47-8e19-f86d0748c483",
        name: "TicketRoute Lab",
        slug: "ticketroute-lab",
        role: "owner" as const,
        timezone: "America/Mexico_City",
        estimationUnit: "days" as const,
        weeklyCapacityHours: 40,
        defaultAiProvider: "manual" as const,
        dataRetentionDays: 365 as const,
        deleteAudioAfterTranscription: true,
        joinedAt: "2026-07-25T20:00:00.000Z",
      },
    ],
    selectWorkspaceAction: vi.fn(async () => undefined),
    signOutAction: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    document.body.style.overflow = "";
  });

  it("muestra la navegación principal y el contenido", () => {
    render(
      <AppShell {...shellProps}>
        <h1>Contenido de prueba</h1>
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Navegación privada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Contenido de prueba" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Command Center" }),
    ).toHaveAttribute("href", "/app");
    expect(screen.getAllByText("TicketRoute Lab").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Equipo" })).toHaveAttribute(
      "href",
      "/app/team",
    );
  });

  it("abre y filtra la paleta global", () => {
    render(
      <AppShell {...shellProps}>
        <div>Contenido</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir comandos" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: "Buscar una sección o comando",
      }),
      { target: { value: "capacidad" } },
    );

    expect(within(dialog).getByText("Capacidad")).toBeInTheDocument();
    expect(within(dialog).queryByText("Integraciones")).not.toBeInTheDocument();
  });

  it("responde al atajo Ctrl + K y permite cerrar con Escape", () => {
    render(
      <AppShell {...shellProps}>
        <div>Contenido</div>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
