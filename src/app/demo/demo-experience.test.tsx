import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoExperience } from "./demo-experience";

describe("DemoExperience", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("recorre captura, aclaración, escenarios y confirmación", () => {
    vi.useFakeTimers();
    render(<DemoExperience />);

    fireEvent.click(
      screen.getByRole("button", { name: "Organizar solicitud" }),
    );

    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(
      screen.getByText(
        "¿Qué debe ocurrir con los usuarios que ya tienen cuenta?",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", {
        name: "Conservar cuentas y vincular Google",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Comparar escenarios" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Compara consecuencias, no solamente personas.",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Transferencia Sofía Reyes/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar este plan" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "El trabajo ya tiene una ruta verificable.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sofía Reyes")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar recorrido" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Ejecutar con estados, evidencia y límites.",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar y calibrar" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "La experiencia ya puede mejorar el siguiente plan.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dentro del rango")).toBeInTheDocument();
  });
});
