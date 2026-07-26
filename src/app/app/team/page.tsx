import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { canManageWorkspace } from "@/domain/workspaces/workspace";
import { TeamManagement } from "@/features/workspaces/components/team-management";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = {
  title: "Equipo",
};

export default async function TeamPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/app/team");
  }

  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) {
    redirect("/onboarding");
  }

  const { data: members, error: membersError } = await supabase.rpc(
    "get_workspace_members",
    {
      p_workspace_id: currentWorkspace.id,
    },
  );

  if (membersError) {
    throw new Error("No se pudo cargar el directorio del workspace.");
  }

  const canManage = canManageWorkspace(currentWorkspace.role);
  const { data: invites, error: invitesError } = canManage
    ? await supabase
        .from("workspace_invites")
        .select("id,email,role,status,expires_at,created_at")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (invitesError) {
    throw new Error("No se pudieron cargar las invitaciones.");
  }

  return (
    <TeamManagement
      workspaceId={currentWorkspace.id}
      workspaceName={currentWorkspace.name}
      actorId={user.id}
      actorRole={currentWorkspace.role}
      members={(members ?? []).map((member) => ({
        userId: member.user_id,
        displayName: member.display_name,
        email: member.email,
        role: member.role,
        joinedAt: member.joined_at,
      }))}
      invites={(invites ?? []).map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
      }))}
    />
  );
}
