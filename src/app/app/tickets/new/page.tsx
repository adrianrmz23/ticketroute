import { redirect } from "next/navigation";

import { organizeCaptureLocally } from "@/application/tickets/organize-capture";
import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { TicketEditor } from "@/features/tickets/components/ticket-editor";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = { title: "Organizar captura" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>;
}) {
  const { capture } = await searchParams;
  const { currentWorkspace } = await getWorkspaceContext();
  if (!capture || !currentWorkspace) {
    redirect("/app/capture");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("tickets")
    .select("id")
    .eq("source_capture_id", capture)
    .maybeSingle();
  if (existing) {
    redirect(`/app/tickets/${existing.id}`);
  }

  const { data, error } = await supabase
    .from("capture_sessions")
    .select("id,input_text,mode,status")
    .eq("id", capture)
    .eq("workspace_id", currentWorkspace.id)
    .eq("status", "ready")
    .maybeSingle();

  if (error || !data) {
    redirect("/app/capture");
  }

  return (
    <TicketEditor
      variant="organize"
      workspaceId={currentWorkspace.id}
      captureId={data.id}
      originalInput={data.input_text}
      initialDraft={organizeCaptureLocally(data.input_text, data.mode)}
    />
  );
}
