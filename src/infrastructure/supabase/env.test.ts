import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseSupabasePublicEnv } from "./env";

describe("parseSupabasePublicEnv", () => {
  it("acepta una URL HTTPS y una Publishable key", () => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://ticketroute.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_publishable_ticketroute_public_key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://ticketroute.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_ticketroute_public_key",
    });
  });

  it("rechaza variables ausentes", () => {
    expect(() => parseSupabasePublicEnv({})).toThrow(ZodError);
  });

  it("rechaza una clave privada por accidente", () => {
    expect(() =>
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://ticketroute.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_secret_ticketroute_private_key",
      }),
    ).toThrow("Usa la Publishable key de Supabase");
  });
});
