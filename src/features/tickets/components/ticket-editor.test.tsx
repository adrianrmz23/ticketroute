import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { organizeCaptureLocally } from "@/application/tickets/organize-capture";

import { TicketEditor } from "./ticket-editor";

vi.mock("@/features/tickets/actions", () => ({
  createTicketFromCaptureAction: vi.fn(),
  updateTicketAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("TicketEditor", () => {
  it("compara la entrada original con un borrador completamente editable", () => {
    const input =
      "Necesitamos agregar inicio de sesión con Google antes del viernes.";

    const draft = organizeCaptureLocally(input, "plan");

    render(
      <TicketEditor
        variant="organize"
        workspaceId="404f8a7c-3d5b-4c47-8e19-f86d0748c483"
        captureId="12f8ea91-f16f-49aa-9731-a096b7e61b6b"
        originalInput={input}
        initialDraft={draft}
      />,
    );

    expect(screen.getByRole("heading", { name: "Entrada original" })).toBeInTheDocument();
    expect(screen.getByDisplayValue(draft.title)).toBeEnabled();
    expect(screen.getByText("Sin envío a proveedores")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar ticket/i })).toBeEnabled();
  });
});
