import { describe, expect, it } from "vitest";

import {
  aiProviders,
  councilRequestSchema,
  providerConfigSchema,
  providerDefaults,
} from "./ai-schemas";

describe("AI contracts", () => {
  it("declara un modelo predeterminado para cada adaptador", () => {
    expect(aiProviders).toHaveLength(5);
    for (const provider of aiProviders) {
      expect(providerDefaults[provider]).toEqual(expect.any(String));
      expect(providerDefaults[provider].length).toBeGreaterThan(2);
    }
  });

  it("rechaza decisiones sin contexto y configuraciones ambiguas", () => {
    expect(
      councilRequestSchema.safeParse({
        workspaceId: crypto.randomUUID(),
        title: "Sí",
        prompt: "corto",
      }).success,
    ).toBe(false);
    expect(
      providerConfigSchema.safeParse({
        workspaceId: crypto.randomUUID(),
        provider: "unknown",
        model: "",
        enabled: true,
        isDefault: false,
      }).success,
    ).toBe(false);
  });
});
