import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { checkSupabaseHealth } from "./check-supabase-health";

describe("checkSupabaseHealth", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.createSupabaseServerClient.mockReset();
    mocks.createSupabaseServerClient.mockResolvedValue({
      rpc: mocks.rpc,
    });
  });

  it("confirma la conexión cuando healthcheck responde", async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: "ok", schema_version: "0013" },
      error: null,
    });

    const health = await checkSupabaseHealth();

    expect(mocks.rpc).toHaveBeenCalledWith("healthcheck");
    expect(health.status).toBe("connected");
    expect(health.latencyMs).toEqual(expect.any(Number));
  });

  it("detecta cuando falta la migración actual", async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: "ok", schema_version: "0001" },
      error: null,
    });

    const health = await checkSupabaseHealth();

    expect(health.status).toBe("migration_pending");
    expect(health.message).toContain("cierre integral");
  });

  it("distingue una migración pendiente de una caída de red", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find public.healthcheck",
      },
    });

    const health = await checkSupabaseHealth();

    expect(health.status).toBe("migration_pending");
    expect(health.message).toContain("migración base");
  });
});
