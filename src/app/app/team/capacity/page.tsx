import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import type {
  CapacityMember,
  MemberPlanningProfile,
} from "@/domain/capacity/capacity";
import { CapacityCenter } from "@/features/capacity/components/capacity-center";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = {
  title: "Capacidad",
};

export default async function CapacityPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/app/team/capacity");
  }

  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) {
    redirect("/onboarding");
  }

  const [
    { data: members, error: membersError },
    { data: profiles, error: profilesError },
    { data: currentPlans, error: plansError },
  ] = await Promise.all([
    supabase.rpc("get_workspace_members", {
      p_workspace_id: currentWorkspace.id,
    }),
    supabase
      .from("member_planning_profiles")
      .select("*")
      .eq("workspace_id", currentWorkspace.id),
    supabase
      .from("assignment_plans")
      .select("id")
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true),
  ]);

  if (membersError) {
    throw new Error("No se pudo cargar el equipo del workspace.");
  }
  if (profilesError) {
    throw new Error(
      "No se pudieron cargar los perfiles. Ejecuta la migración del Bloque 10.",
    );
  }
  if (plansError) {
    throw new Error("No se pudo calcular la carga confirmada.");
  }

  const activePlanIds = (currentPlans ?? []).map((plan) => plan.id);
  const { data: participants, error: participantsError } = activePlanIds.length
    ? await supabase
        .from("assignment_plan_participants")
        .select("assignment_plan_id,user_id")
        .in("assignment_plan_id", activePlanIds)
    : { data: [], error: null };
  if (participantsError) {
    throw new Error("No se pudo calcular la participación vigente.");
  }

  const activeCounts = new Map<string, number>();
  for (const participant of participants ?? []) {
    activeCounts.set(
      participant.user_id,
      (activeCounts.get(participant.user_id) ?? 0) + 1,
    );
  }

  const profileByUserId = new Map<string, MemberPlanningProfile>(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      {
        workspaceId: profile.workspace_id,
        userId: profile.user_id,
        availabilityHours: profile.availability_hours,
        plannedHours: profile.planned_hours,
        skills: profile.skills,
        componentExperience: profile.component_experience,
        technicalOwnership: profile.technical_ownership,
        learningGoals: profile.learning_goals,
        updatedAt: profile.updated_at,
      },
    ]),
  );

  const capacityMembers: CapacityMember[] = (members ?? []).map((member) => ({
    userId: member.user_id,
    displayName: member.display_name,
    email: member.email,
    role: member.role,
    joinedAt: member.joined_at,
    activeAssignmentCount: activeCounts.get(member.user_id) ?? 0,
    profile: profileByUserId.get(member.user_id) ?? null,
  }));

  return (
    <CapacityCenter
      workspaceId={currentWorkspace.id}
      workspaceName={currentWorkspace.name}
      fallbackWeeklyHours={currentWorkspace.weeklyCapacityHours}
      actorId={user.id}
      actorRole={currentWorkspace.role}
      members={capacityMembers}
    />
  );
}

