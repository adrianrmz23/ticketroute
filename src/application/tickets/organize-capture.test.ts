import { describe, expect, it } from "vitest";

import { organizeCaptureLocally } from "./organize-capture";

describe("organizeCaptureLocally", () => {
  it("estructura una solicitud sin inventar una cifra de estimación", () => {
    const draft = organizeCaptureLocally(
      "Necesitamos agregar inicio de sesión con Google antes del viernes. El frontend está listo.",
      "plan",
    );

    expect(draft.title).toContain("inicio de sesión con Google");
    expect(draft.priority).toBe("high");
    expect(draft.labels).toContain("autenticación");
    expect(draft.unknowns).toContain(
      "¿Qué debe ocurrir con los usuarios existentes durante el cambio?",
    );
    expect(draft.acceptanceCriteria).toHaveLength(3);
  });

  it("limita las preguntas prioritarias a dos", () => {
    const draft = organizeCaptureLocally(
      "Necesitamos modernizar una parte interna sin fecha definida.",
      "plan",
    );

    expect(draft.unknowns.length).toBeLessThanOrEqual(2);
  });
});
