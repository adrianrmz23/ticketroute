import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CaptureHub } from "./capture-hub";

vi.mock("@/features/capture/actions", () => ({
  saveCaptureAction: vi.fn(async () => ({
    status: "success",
    message: "Borrador guardado.",
    captureId: "12f8ea91-f16f-49aa-9731-a096b7e61b6b",
    savedAt: "2026-07-26T01:00:00.000Z",
  })),
  archiveCaptureAction: vi.fn(async () => ({
    status: "success",
    message: "Captura archivada.",
  })),
  recordMicrophoneConsentAction: vi.fn(async () => ({
    status: "success",
    message: "Preferencia registrada.",
  })),
}));

describe("CaptureHub", () => {
  it("presenta entrada manual y consentimiento antes del micrófono", () => {
    render(
      <CaptureHub
        workspaceId="404f8a7c-3d5b-4c47-8e19-f86d0748c483"
        editable
        deleteAudioAfterTranscription
        initialSessions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Capture Hub" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contenido de la captura")).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Iniciar dictado" }));

    expect(
      screen.getByRole("dialog", { name: "Tú decides cuándo escuchamos." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Consentimiento registrado")).toBeInTheDocument();
  });

  it("mantiene la superficie en consulta para Viewer", () => {
    render(
      <CaptureHub
        workspaceId="404f8a7c-3d5b-4c47-8e19-f86d0748c483"
        editable={false}
        deleteAudioAfterTranscription
        initialSessions={[]}
      />,
    );

    expect(screen.getByLabelText("Contenido de la captura")).toBeDisabled();
    expect(
      screen.getByText("Tu rol Viewer permite consultar, no crear capturas."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Iniciar dictado" }),
    ).not.toBeInTheDocument();
  });
});
