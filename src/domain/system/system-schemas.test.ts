import { describe, expect, it } from "vitest";

import {
  integrationSchema,
  notificationPreferencesSchema,
} from "./system-schemas";

const workspaceId = "10000000-0000-4000-8000-000000000001";

describe("system contracts", () => {
  it("acepta metadatos HTTPS y rechaza secretos embebidos en la URL", () => {
    expect(
      integrationSchema.safeParse({
        workspaceId,
        provider: "github",
        displayName: "Issues",
        endpoint: "https://api.github.com/repos/acme/product/issues",
        enabled: true,
      }).success,
    ).toBe(true);
    for (const endpoint of [
      "http://api.example.com",
      "https://user:password@example.com/hook",
      "https://example.com/hook?token=secret",
      "https://example.com/hook#secret",
    ]) {
      expect(
        integrationSchema.safeParse({
          workspaceId,
          provider: "webhook",
          displayName: "Unsafe",
          endpoint,
          enabled: true,
        }).success,
      ).toBe(false);
    }
  });

  it("mantiene preferencias acotadas a frecuencias conocidas", () => {
    expect(
      notificationPreferencesSchema.safeParse({
        workspaceId,
        inApp: true,
        email: false,
        blockedSteps: true,
        assignments: true,
        invitations: true,
        councilResults: true,
        digestFrequency: "hourly",
      }).success,
    ).toBe(false);
  });
});
