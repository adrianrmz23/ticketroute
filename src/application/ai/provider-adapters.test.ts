import { afterEach, describe, expect, it, vi } from "vitest";

import { runCouncil } from "./provider-adapters";

const providerVariables = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "MOONSHOT_API_KEY",
  "KIMI_API_KEY",
] as const;

describe("provider adapters", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("identifica el fallback local cuando falta una credencial", async () => {
    for (const variable of providerVariables) {
      vi.stubEnv(variable, "");
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runCouncil(
      "Decidir una ruta reversible con evidencia y capacidad declarada.",
      [{ provider: "openai", model: "gpt-5.6" }],
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.opinions).toHaveLength(1);
    expect(result.opinions[0]).toMatchObject({
      provider: "openai",
      source: "local_fallback",
      confidence: "low",
    });
    expect(result.limitations[0]).toContain("credencial ausente");
  });

  it("produce tres perspectivas locales cuando no hay proveedores activos", async () => {
    const result = await runCouncil(
      "Comparar riesgo, capacidad y verificación antes de confirmar.",
      [],
    );

    expect(result.opinions).toHaveLength(3);
    expect(result.opinions.every((item) => item.source === "local_fallback"))
      .toBe(true);
    expect(result.synthesis).toContain("decisión humana");
  });
});
