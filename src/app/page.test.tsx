import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("presenta la propuesta de valor y acceso a la demo", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Antes de estimar/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Probar demo/i })[0],
    ).toHaveAttribute("href", "/demo");
    expect(
      screen.getByText("Rangos explicables, nunca cifras mágicas"),
    ).toBeInTheDocument();
  });
});
