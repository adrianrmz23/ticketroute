import { NextResponse } from "next/server";

import { checkSupabaseHealth } from "@/application/system/check-supabase-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkSupabaseHealth();

  return NextResponse.json(health, {
    status: health.status === "connected" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
