import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: privacyRequest } = await supabase
    .from("privacy_requests")
    .select("*")
    .eq("id", requestId)
    .eq("requested_by", user.id)
    .eq("request_type", "export")
    .eq("status", "completed")
    .maybeSingle();
  if (!privacyRequest) {
    return NextResponse.json({ error: "Export not ready" }, { status: 404 });
  }

  const [
    { data: profile },
    { data: memberships },
    { data: captures },
    { data: tickets },
    { data: auditEvents },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", privacyRequest.workspace_id),
    supabase
      .from("capture_sessions")
      .select("*")
      .eq("created_by", user.id)
      .eq("workspace_id", privacyRequest.workspace_id),
    supabase
      .from("tickets")
      .select("*")
      .eq("created_by", user.id)
      .eq("workspace_id", privacyRequest.workspace_id),
    supabase
      .from("audit_events")
      .select("*")
      .eq("actor_id", user.id)
      .eq("workspace_id", privacyRequest.workspace_id),
  ]);
  return new NextResponse(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        requestId,
        userId: user.id,
        workspaceId: privacyRequest.workspace_id,
        profile,
        memberships: memberships ?? [],
        captures: captures ?? [],
        tickets: tickets ?? [],
        auditEvents: auditEvents ?? [],
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ticketroute-export-${requestId}.json"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
