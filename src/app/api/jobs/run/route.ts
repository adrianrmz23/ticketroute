import { NextResponse } from "next/server";

import { processBackgroundJob } from "@/application/jobs/process-background-job";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runJobs(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }
  const { data: jobs, error } = await supabase.rpc("claim_background_jobs", {
    p_limit: 10,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  for (const job of jobs ?? []) {
    await processBackgroundJob(supabase, job);
  }
  return NextResponse.json({
    processed: jobs?.length ?? 0,
    checkedAt: new Date().toISOString(),
  });
}

export const GET = runJobs;
export const POST = runJobs;
