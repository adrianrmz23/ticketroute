import { describe, expect, it } from "vitest";

import { saveCaptureSchema } from "./capture-schemas";

const baseCapture = {
  id: "12f8ea91-f16f-49aa-9731-a096b7e61b6b",
  workspaceId: "404f8a7c-3d5b-4c47-8e19-f86d0748c483",
  mode: "plan",
  source: "manual",
  inputText: "Necesitamos agregar autenticación con Google.",
  status: "draft",
};

describe("capture schemas", () => {
  it("acepta un borrador manual válido", () => {
    expect(saveCaptureSchema.safeParse(baseCapture).success).toBe(true);
  });

  it("exige contexto mínimo al marcar una entrada como lista", () => {
    const result = saveCaptureSchema.safeParse({
      ...baseCapture,
      inputText: "Muy corto",
      status: "ready",
    });

    expect(result.success).toBe(false);
  });

  it("limita la entrada original a 20,000 caracteres", () => {
    const result = saveCaptureSchema.safeParse({
      ...baseCapture,
      inputText: "a".repeat(20001),
    });

    expect(result.success).toBe(false);
  });
});
