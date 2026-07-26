import { describe, expect, it } from "vitest";

import { canManageRole, canManageWorkspace } from "./workspace";

describe("workspace permissions", () => {
  it("limita la administración a owners y admins", () => {
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageWorkspace("admin")).toBe(true);
    expect(canManageWorkspace("planner")).toBe(false);
  });

  it("impide que un admin modifique roles privilegiados", () => {
    expect(canManageRole("admin", "member", "planner")).toBe(true);
    expect(canManageRole("admin", "admin", "member")).toBe(false);
    expect(canManageRole("admin", "member", "owner")).toBe(false);
    expect(canManageRole("owner", "admin", "viewer")).toBe(true);
  });
});
