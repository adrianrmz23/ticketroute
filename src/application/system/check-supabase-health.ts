import { z, ZodError } from "zod";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export type SupabaseHealthStatus =
  | "connected"
  | "migration_pending"
  | "misconfigured"
  | "unreachable";

export type SupabaseHealth = {
  status: SupabaseHealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  message: string;
};

const healthcheckSchema = z.object({
  status: z.literal("ok"),
  schema_version: z.string(),
});

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  const checkedAt = new Date().toISOString();
  const startedAt = performance.now();

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("healthcheck");
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));

    if (!error) {
      const payload = healthcheckSchema.safeParse(data);
      if (!payload.success || payload.data.schema_version !== "0013") {
        return {
          status: "migration_pending",
          latencyMs,
          checkedAt,
          message:
            "La conexión funciona, pero faltan migraciones del cierre integral.",
        };
      }

      return {
        status: "connected",
        latencyMs,
        checkedAt,
        message: "PostgreSQL respondió y el esquema 0013 está activo.",
      };
    }

    const migrationMissing =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      error.message.toLowerCase().includes("healthcheck");

    return {
      status: migrationMissing ? "migration_pending" : "unreachable",
      latencyMs,
      checkedAt,
      message: migrationMissing
        ? "La conexión funciona, pero todavía debes ejecutar la migración base."
        : "Supabase no pudo completar la comprobación.",
    };
  } catch (error) {
    return {
      status: error instanceof ZodError ? "misconfigured" : "unreachable",
      latencyMs: null,
      checkedAt,
      message:
        error instanceof ZodError
          ? "Revisa las variables NEXT_PUBLIC_SUPABASE_* en .env.local."
          : "No fue posible contactar a Supabase en este momento.",
    };
  }
}
