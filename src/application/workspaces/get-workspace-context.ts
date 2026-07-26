import { cookies } from "next/headers";

import type { WorkspaceSummary } from "@/domain/workspaces/workspace";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const ACTIVE_WORKSPACE_COOKIE = "ticketroute-active-workspace";

type WorkspaceContext = {
  currentWorkspace: WorkspaceSummary | null;
  availableWorkspaces: WorkspaceSummary[];
};

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_workspaces");

  if (error) {
    throw new Error("No se pudo consultar el contexto del workspace.");
  }

  const availableWorkspaces: WorkspaceSummary[] = (data ?? []).map(
    (workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: workspace.role,
      timezone: workspace.timezone,
      estimationUnit: workspace.estimation_unit as
        | "hours"
        | "days"
        | "points",
      weeklyCapacityHours: workspace.weekly_capacity_hours,
      defaultAiProvider: workspace.default_ai_provider as
        | "manual"
        | "openai"
        | "anthropic"
        | "gemini",
      dataRetentionDays: workspace.data_retention_days as
        | 30
        | 90
        | 180
        | 365
        | 730,
      deleteAudioAfterTranscription:
        workspace.delete_audio_after_transcription,
      joinedAt: workspace.joined_at,
    }),
  );

  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(
    ACTIVE_WORKSPACE_COOKIE,
  )?.value;
  const currentWorkspace =
    availableWorkspaces.find(
      (workspace) => workspace.id === requestedWorkspaceId,
    ) ??
    availableWorkspaces[0] ??
    null;

  return { currentWorkspace, availableWorkspaces };
}
