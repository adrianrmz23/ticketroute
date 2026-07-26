import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("conserva rutas internas", () => {
    expect(getSafeRedirectPath("/app/settings/system")).toBe(
      "/app/settings/system",
    );
  });

  it("bloquea redirecciones absolutas", () => {
    expect(getSafeRedirectPath("https://malicious.example")).toBe("/app");
    expect(getSafeRedirectPath("//malicious.example")).toBe("/app");
    expect(getSafeRedirectPath("/\\malicious.example")).toBe("/app");
  });
});
