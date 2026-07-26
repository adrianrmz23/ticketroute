import { z } from "zod";

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url("NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida")
    .refine(
      (value) =>
        value.startsWith("https://") || value.startsWith("http://localhost:"),
      "La URL de Supabase debe usar HTTPS",
    ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(20, "La clave pública de Supabase está incompleta")
    .refine(
      (value) =>
        value.startsWith("sb_publishable_") ||
        value.startsWith("eyJ"),
      "Usa la Publishable key de Supabase",
    ),
});

export type SupabasePublicEnv = z.infer<typeof supabasePublicEnvSchema>;

export function parseSupabasePublicEnv(
  input: Record<string, string | undefined>,
): SupabasePublicEnv {
  return supabasePublicEnvSchema.parse(input);
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getSupabaseEnvPresence() {
  return {
    url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
