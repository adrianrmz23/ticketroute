import { notFound } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import type { ExecutionRun } from "@/domain/execution/execution";
import { estimationUnitLabels } from "@/domain/planning/estimate";
import { ExecutionBoardDetail } from "@/features/execution/components/execution-board-detail";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = { title: "Recorrido de ejecución" };

export default async function ExecutionBoardTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) notFound();

  const supabase = await createSupabaseServerClient();
  const [
    { data: authData },
    { data: ticket },
    { data: guide, error: guideError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tickets")
      .select("id,title,status")
      .eq("id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .maybeSingle(),
    supabase
      .from("planning_guides")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true)
      .maybeSingle(),
    supabase.rpc("get_workspace_members", {
      p_workspace_id: currentWorkspace.id,
    }),
  ]);

  if (!ticket || !guide) notFound();
  if (guideError) {
    throw new Error(
      "No se pudo cargar la guía vigente para este recorrido.",
    );
  }
  if (membersError) {
    throw new Error("No se pudieron resolver los responsables del recorrido.");
  }

  const [
    { data: assignment },
    { data: guideSteps, error: guideStepsError },
    { data: run, error: runError },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("assignment_plans")
      .select("range_low,range_high,unit")
      .eq("id", guide.assignment_plan_id)
      .maybeSingle(),
    supabase
      .from("planning_guide_steps")
      .select("id,responsible_user_id")
      .eq("planning_guide_id", guide.id)
      .order("position"),
    supabase
      .from("execution_runs")
      .select("*")
      .eq("planning_guide_id", guide.id)
      .maybeSingle(),
    supabase
      .from("member_planning_profiles")
      .select("user_id,availability_hours,planned_hours")
      .eq("workspace_id", currentWorkspace.id),
  ]);

  if (guideStepsError || runError) {
    throw new Error(
      "No se pudo cargar Execution Board. Ejecuta la migración del Bloque 12.",
    );
  }

  const memberById = new Map(
    (members ?? []).map((member) => [member.user_id, member.display_name]),
  );
  let mappedRun: ExecutionRun | null = null;
  if (run) {
    const { data: steps, error: stepsError } = await supabase
      .from("execution_steps")
      .select("*")
      .eq("execution_run_id", run.id)
      .order("position");

    if (stepsError) {
      throw new Error("No se pudieron cargar los pasos de ejecución.");
    }

    mappedRun = {
      id: run.id,
      ticketId: run.ticket_id,
      guideId: run.planning_guide_id,
      guideVersion: guide.version,
      status: run.status,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      steps: (steps ?? []).map((step) => ({
        id: step.id,
        guideStepId: step.planning_guide_step_id,
        position: step.position,
        phase: step.phase,
        title: step.title_snapshot,
        outcome: step.outcome_snapshot,
        responsibleUserId: step.responsible_user_id,
        responsibleName:
          memberById.get(step.responsible_user_id) ?? "Integrante",
        effortShare: step.effort_share,
        verification: step.verification_snapshot,
        sourceKind: step.source_kind,
        sourceLabel: step.source_label,
        dependencies: step.dependencies_snapshot,
        risks: step.risks_snapshot,
        status: step.status,
        evidenceNote: step.evidence_note,
        blockerNote: step.blocker_note,
        startedAt: step.started_at,
        completedAt: step.completed_at,
        updatedAt: step.updated_at,
      })),
    };
  }

  const teamCount = new Set(
    (guideSteps ?? []).map((step) => step.responsible_user_id),
  ).size;
  const profileByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile]),
  );
  const capacityWarnings = Array.from(
    new Set((guideSteps ?? []).map((step) => step.responsible_user_id)),
  )
    .map((userId) => {
      const profile = profileByUserId.get(userId);
      const name = memberById.get(userId) ?? "Integrante";
      if (!profile || profile.availability_hours === null) {
        return `${name}: disponibilidad aún no declarada.`;
      }
      if (profile.planned_hours >= profile.availability_hours) {
        return `${name}: carga declarada sin margen (${profile.planned_hours}/${profile.availability_hours} h).`;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
  const rangeLabel = assignment
    ? `${assignment.range_low}–${assignment.range_high} ${
        estimationUnitLabels[assignment.unit]
      }`
    : "Rango confirmado";

  return (
    <ExecutionBoardDetail
      ticketId={ticket.id}
      workspaceId={currentWorkspace.id}
      ticketTitle={ticket.title}
      guideId={guide.id}
      guideVersion={guide.version}
      guideObjective={guide.objective}
      rangeLabel={rangeLabel}
      guideStepCount={guideSteps?.length ?? 0}
      guideTeamCount={teamCount}
      run={mappedRun}
      canManageAll={["owner", "admin", "planner"].includes(
        currentWorkspace.role,
      )}
      currentUserId={authData.user?.id ?? ""}
      capacityWarnings={capacityWarnings}
    />
  );
}
