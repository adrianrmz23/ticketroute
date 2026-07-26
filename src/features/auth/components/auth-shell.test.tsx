import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "./auth-shell";

describe("AuthShell", () => {
  it("presenta la operación de acceso y el formulario recibido", () => {
    render(
      <AuthShell
        eyebrow="ACCESO"
        title="Identidad verificable"
        description="Descripción de prueba"
      >
        <button type="button">Continuar</button>
      </AuthShell>,
    );

    expect(
      screen.getByRole("heading", { name: "Identidad verificable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sesión validada en servidor"),
    ).toBeInTheDocument();
  });
});
