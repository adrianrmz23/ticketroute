import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingForm } from "./onboarding-form";

vi.mock("@/features/workspaces/actions", () => ({
  createWorkspaceAction: vi.fn(async () => ({
    status: "idle",
    message: "",
  })),
}));

describe("OnboardingForm", () => {
  it("recorre la configuración sin ocultar decisiones de privacidad", async () => {
    render(<OnboardingForm displayName="Adrián" />);

    expect(
      screen.getByRole("heading", {
        name: "Construyamos tu base, Adrián.",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      await screen.findByRole("heading", {
        name: "Define cómo planea tu equipo.",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      await screen.findByRole("heading", {
        name: "Establece la frontera de control.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Eliminar audio después de transcribir"),
    ).toBeInTheDocument();
  });
});
