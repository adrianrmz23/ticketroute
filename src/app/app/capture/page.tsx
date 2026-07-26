import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import type { CaptureSession } from "@/domain/capture/capture";
import { CaptureHub } from "@/features/capture/components/capture-hub";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = {
  title: "Capture Hub",
};

export default async function CapturePage() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("capture_sessions")
    .select(
      "id,workspace_id,created_by,mode,source,input_text,status,created_at,updated_at",
    )
    .eq("workspace_id", currentWorkspace.id)
    .eq("created_by", user.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error("No se pudieron cargar las sesiones de captura.");
  }

  const sessions: CaptureSession[] = (data ?? []).map((session) => ({
    id: session.id,
    workspaceId: session.workspace_id,
    createdBy: session.created_by,
    mode: session.mode,
    source: session.source,
    inputText: session.input_text,
    status: session.status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }));

  return (
    <CaptureHub
      workspaceId={currentWorkspace.id}
      editable={currentWorkspace.role !== "viewer"}
      deleteAudioAfterTranscription={
        currentWorkspace.deleteAudioAfterTranscription
      }
      initialSessions={sessions}
    />
  );
}
