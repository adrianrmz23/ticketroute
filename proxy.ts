import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "@/infrastructure/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/app/:path*",
    "/auth/:path*",
    "/onboarding/:path*",
    "/invite/:path*",
  ],
};
