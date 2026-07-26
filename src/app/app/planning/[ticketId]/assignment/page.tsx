import { notFound } from "next/navigation";

import { generateAssignmentScenarios } from "@/application/assignment/generate-assignment-scenarios";
import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import {
  assignmentLoadLabels,
  assignmentStrategyLabels,
  type AssignmentEvidence,
  type AssignmentScenario,
} from "@/domain/assignment/assignment";
import { AssignmentStudio } from "@/features/assignment/components/assignment-studio";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = { title: "Assignment Studio" };

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function jsonEvidence(value: Json | undefined): AssignmentEvidence[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const object = jsonObject(item);
    const status = object.status;
    if (
      typeof object.signal !== "string" ||
      typeof object.detail !== "string" ||
      !["used", "missing", "excluded"].includes(String(status))
    ) {
      return [];
    }

    return [
      {
        signal: object.signal,
        detail: object.detail,
        status: status as AssignmentEvidence["status"],
      },
    ];
  });
}

export default async function AssignmentPage({
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
    { data: estimate },
    { data: members, error: membersError },
    { data: planningProfiles, error: profilesError },
    { data: currentPlans },
    { data: confirmedPlan },
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id,title,status,created_by,context,technical_requirements,labels,dependencies_notes",
      )
      .eq("id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .maybeSingle(),
    supabase
      .from("estimates")
      .select(
        "id,version,unit,confidence,favorable_low,favorable_high,probable_low,probable_high,adverse_low,adverse_high",
      )
      .eq("ticket_id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true)
      .maybeSingle(),
    supabase.rpc("get_workspace_members", {
      p_workspace_id: currentWorkspace.id,
    }),
    supabase
      .from("member_planning_profiles")
      .select(
        "user_id,availability_hours,planned_hours,skills,component_experience,technical_ownership,learning_goals",
      )
      .eq("workspace_id", currentWorkspace.id),
    supabase
      .from("assignment_plans")
      .select("id")
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true),
    supabase
      .from("assignment_plans")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("workspace_id", currentWorkspace.id)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  if (!ticket || !estimate) notFound();
  if (membersError) {
    throw new Error("No se pudo cargar el equipo elegible.");
  }
  if (profilesError) {
    throw new Error(
      "No se pudieron cargar las señales declaradas del equipo.",
    );
  }

  const activePlanIds = (currentPlans ?? []).map((plan) => plan.id);
  const { data: activeParticipants } = activePlanIds.length
    ? await supabase
        .from("assignment_plan_participants")
        .select("assignment_plan_id,user_id")
        .in("assignment_plan_id", activePlanIds)
    : { data: [] };
  const activeCounts = new Map<string, number>();
  for (const participant of activeParticipants ?? []) {
    activeCounts.set(
      participant.user_id,
      (activeCounts.get(participant.user_id) ?? 0) + 1,
    );
  }

  const profileByUserId = new Map(
    (planningProfiles ?? []).map((profile) => [profile.user_id, profile]),
  );
  const candidateMembers = (members ?? []).map((member) => {
    const profile = profileByUserId.get(member.user_id);
    return {
      userId: member.user_id,
      displayName: member.display_name,
      role: member.role,
      joinedAt: member.joined_at,
      activeAssignmentCount: activeCounts.get(member.user_id) ?? 0,
      priorParticipation: member.user_id === ticket.created_by,
      planningProfile: profile
        ? {
            availabilityHours: profile.availability_hours,
            plannedHours: profile.planned_hours,
            skills: profile.skills,
            componentExperience: profile.component_experience,
            technicalOwnership: profile.technical_ownership,
            learningGoals: profile.learning_goals,
          }
        : null,
    };
  });

  let scenarios = generateAssignmentScenarios({
    estimate: {
      id: estimate.id,
      unit: estimate.unit,
      confidence: estimate.confidence,
      favorable: {
        low: estimate.favorable_low,
        high: estimate.favorable_high,
      },
      probable: {
        low: estimate.probable_low,
        high: estimate.probable_high,
      },
      adverse: {
        low: estimate.adverse_low,
        high: estimate.adverse_high,
      },
    },
    candidates: candidateMembers,
    weeklyCapacityHours: currentWorkspace.weeklyCapacityHours,
    dependencies: ticket.dependencies_notes,
    workSignals: [
      ticket.title,
      ticket.context,
      ...ticket.technical_requirements,
      ...ticket.labels,
    ],
  });

  let confirmedScenario: AssignmentScenario | null = null;
  if (confirmedPlan) {
    const { data: planParticipants } = await supabase
      .from("assignment_plan_participants")
      .select("*")
      .eq("assignment_plan_id", confirmedPlan.id)
      .order("participation_role", { ascending: false });
    const memberById = new Map(
      candidateMembers.map((member) => [member.userId, member]),
    );
    const snapshot = jsonObject(confirmedPlan.evidence_snapshot);
    const fallback =
      scenarios.find(
        (scenario) => scenario.strategy === confirmedPlan.strategy,
      ) ?? scenarios[0];

    if (fallback) {
      confirmedScenario = {
        ...fallback,
        strategy: confirmedPlan.strategy,
        label: assignmentStrategyLabels[confirmedPlan.strategy],
        summary:
          typeof snapshot.summary === "string"
            ? snapshot.summary
            : fallback.summary,
        estimateId: confirmedPlan.estimate_id,
        range: {
          low: confirmedPlan.range_low,
          high: confirmedPlan.range_high,
          unit: confirmedPlan.unit,
        },
        confidence: confirmedPlan.confidence,
        participants: (planParticipants ?? []).map((participant) => ({
          userId: participant.user_id,
          displayName:
            memberById.get(participant.user_id)?.displayName ?? "Integrante",
          participationRole: participant.participation_role,
          contributionPercent: participant.contribution_percent,
          reason: participant.reason,
        })),
        resultingLoad: {
          level: confirmedPlan.resulting_load_level,
          percentage: confirmedPlan.resulting_load_percent,
          label:
            confirmedPlan.resulting_load_percent === null
              ? assignmentLoadLabels[confirmedPlan.resulting_load_level]
              : `${assignmentLoadLabels[confirmedPlan.resulting_load_level]} · ${confirmedPlan.resulting_load_percent}%`,
          basis:
            "Snapshot confirmado sobre capacidad y planes visibles en ese momento.",
        },
        knowledgeConcentration: confirmedPlan.knowledge_concentration,
        rationale: confirmedPlan.rationale,
        risks: confirmedPlan.risks,
        discardedAlternatives: confirmedPlan.discarded_alternatives,
        changeConsequence: confirmedPlan.change_consequence,
        evidence: jsonEvidence(snapshot.signals),
        evidenceLimitations: confirmedPlan.evidence_limitations,
        engineKind: "local_rules",
        engineVersion: "tr-assignment-2",
      };
      scenarios = scenarios.map((scenario) =>
        scenario.strategy === confirmedPlan.strategy
          ? confirmedScenario!
          : scenario,
      );
    }
  }

  if (!scenarios.length) {
    throw new Error(
      "El workspace necesita al menos un integrante operativo para asignar.",
    );
  }

  return (
    <AssignmentStudio
      key={confirmedPlan?.id ?? "draft"}
      ticketId={ticket.id}
      ticketTitle={ticket.title}
      estimateVersion={estimate.version}
      weeklyCapacityHours={currentWorkspace.weeklyCapacityHours}
      candidates={candidateMembers.filter((member) => member.role !== "viewer")}
      initialScenarios={scenarios}
      initialStrategy={confirmedScenario?.strategy ?? "balanced_load"}
      rangeEnvelope={{
        low: estimate.favorable_low,
        high: estimate.adverse_high,
      }}
      confirmedVersion={confirmedPlan?.version ?? null}
      confirmedAt={confirmedPlan?.created_at ?? null}
    />
  );
}
