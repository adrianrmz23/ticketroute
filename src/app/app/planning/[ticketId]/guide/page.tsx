import { notFound } from "next/navigation";

import { generatePlanningGuide } from "@/application/guides/generate-planning-guide";
import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import type {
  GuideCandidate,
  PlanningGuide,
} from "@/domain/guides/planning-guide";
import type { TicketDraft } from "@/domain/tickets/ticket";
import { PlanningGuideEditor } from "@/features/guides/components/planning-guide-editor";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = { title: "Planning Guide" };

export default async function PlanningGuidePage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) notFound();

  const supabase = await createSupabaseServerClient();
  const [
    { data: ticket },
    { data: criteria },
    { data: subtasks },
    { data: estimate },
    { data: assignment },
    { data: currentGuide, error: guideError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .maybeSingle(),
    supabase
      .from("ticket_criteria")
      .select("content")
      .eq("ticket_id", ticketId)
      .order("position"),
    supabase
      .from("ticket_subtasks")
      .select("title")
      .eq("ticket_id", ticketId)
      .order("position"),
    supabase
      .from("estimates")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("assignment_plans")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true)
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

  if (!ticket || !estimate || !assignment) notFound();
  if (guideError) {
    throw new Error(
      "No se pudo cargar Planning Guide. Ejecuta la migración del Bloque 11.",
    );
  }
  if (membersError) {
    throw new Error("No se pudieron resolver los responsables del workspace.");
  }

  const [{ data: participants, error: participantsError }, guideStepsResult] =
    await Promise.all([
      supabase
        .from("assignment_plan_participants")
        .select("*")
        .eq("assignment_plan_id", assignment.id)
        .order("participation_role", { ascending: false }),
      currentGuide
        ? supabase
            .from("planning_guide_steps")
            .select("*")
            .eq("planning_guide_id", currentGuide.id)
            .order("position")
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (participantsError || guideStepsResult.error) {
    throw new Error("No se pudo reconstruir el recorrido confirmado.");
  }

  const memberById = new Map(
    (members ?? []).map((member) => [member.user_id, member]),
  );
  const candidates: GuideCandidate[] = (participants ?? []).map(
    (participant) => ({
      userId: participant.user_id,
      displayName:
        memberById.get(participant.user_id)?.display_name ?? "Integrante",
      participationRole: participant.participation_role,
      contributionPercent: participant.contribution_percent,
    }),
  );

  if (!candidates.length) {
    throw new Error(
      "La asignación vigente necesita al menos una persona antes de crear la guía.",
    );
  }

  const draft: TicketDraft = {
    title: ticket.title,
    objective: ticket.objective,
    problem: ticket.problem,
    context: ticket.context,
    expectedOutcome: ticket.expected_outcome,
    scope: ticket.scope,
    outOfScope: ticket.out_of_scope,
    functionalRequirements: ticket.functional_requirements,
    technicalRequirements: ticket.technical_requirements,
    constraints: ticket.constraints,
    acceptanceCriteria: (criteria ?? []).map((item) => item.content),
    risks: ticket.risks,
    assumptions: ticket.assumptions,
    unknowns: ticket.unknowns,
    dependencies: ticket.dependencies_notes,
    labels: ticket.labels,
    priority: ticket.priority,
    targetDate: ticket.target_date ?? "",
    subtasks: (subtasks ?? []).map((item) => item.title),
    status: ticket.status,
  };

  const generatedGuide = generatePlanningGuide({
    ticketId: ticket.id,
    ticket: draft,
    estimate: {
      id: estimate.id,
      low: assignment.range_low,
      high: assignment.range_high,
      unit: assignment.unit,
    },
    assignment: {
      id: assignment.id,
      participants: candidates,
      evidenceLimitations: assignment.evidence_limitations,
    },
  });

  const currentGuideMatchesSources =
    currentGuide?.estimate_id === estimate.id &&
    currentGuide.assignment_plan_id === assignment.id;
  const initialGuide: PlanningGuide = currentGuideMatchesSources
    ? {
        ticketId: ticket.id,
        estimateId: currentGuide.estimate_id,
        assignmentPlanId: currentGuide.assignment_plan_id,
        objective: currentGuide.objective,
        sequenceRationale: currentGuide.sequence_rationale,
        verificationStrategy: currentGuide.verification_strategy,
        estimateRange: {
          low: assignment.range_low,
          high: assignment.range_high,
          unit: assignment.unit,
        },
        steps: (guideStepsResult.data ?? []).map((step) => ({
          localId: step.id,
          position: step.position,
          phase: step.phase,
          title: step.title,
          outcome: step.outcome,
          responsibleUserId: step.responsible_user_id,
          responsibleName:
            memberById.get(step.responsible_user_id)?.display_name ??
            "Integrante",
          effortShare: step.effort_share,
          verification: step.verification,
          dependencies: step.dependencies,
          risks: step.risks,
          sourceKind: step.source_kind,
          sourceLabel: step.source_label,
        })),
        assumptions: currentGuide.assumptions,
        evidenceLimitations: currentGuide.evidence_limitations,
        engineKind: "local_rules",
        engineVersion: "tr-guide-1",
      }
    : generatedGuide;

  return (
    <PlanningGuideEditor
      key={currentGuideMatchesSources ? currentGuide.id : assignment.id}
      ticketId={ticket.id}
      ticketTitle={ticket.title}
      assignmentVersion={assignment.version}
      candidates={candidates}
      initialGuide={initialGuide}
      generatedGuide={generatedGuide}
      confirmedVersion={
        currentGuideMatchesSources ? currentGuide.version : null
      }
      confirmedGuideId={
        currentGuideMatchesSources ? currentGuide.id : null
      }
      confirmedAt={
        currentGuideMatchesSources ? currentGuide.created_at : null
      }
      sourcesChanged={Boolean(currentGuide && !currentGuideMatchesSources)}
    />
  );
}
