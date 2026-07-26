import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/infrastructure/supabase/database.types";
import { getSupabasePublicEnv } from "@/infrastructure/supabase/env";

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicEnv();
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
