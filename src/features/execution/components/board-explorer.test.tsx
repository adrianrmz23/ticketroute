import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardExplorer, type BoardItem } from "./board-explorer";

const items: BoardItem[] = [
  {
    ticketId: "10000000-0000-4000-8000-000000000001",
    title: "Preparar autenticación",
    objective: "Conservar acceso existente",
    status: "active",
    progress: 40,
    guideVersion: 2,
    range: "3–5 días",
    confidence: "Media",
  },
  {
    ticketId: "10000000-0000-4000-8000-000000000002",
    title: "Publicar documentación",
    objective: "Cerrar el recorrido",
    status: "completed",
    progress: 100,
    guideVersion: 1,
    range: "1–2 días",
    confidence: "Alta",
  },
];

describe("BoardExplorer", () => {
  it("filtra recorridos y alterna a una lista accesible", () => {
    render(<BoardExplorer items={items} />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar en Execution Board" }),
      { target: { value: "autenticación" } },
    );
    expect(screen.getByText("Preparar autenticación")).toBeInTheDocument();
    expect(screen.queryByText("Publicar documentación")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vista de lista" }));
    expect(screen.getAllByText("En ejecución")).toHaveLength(2);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
