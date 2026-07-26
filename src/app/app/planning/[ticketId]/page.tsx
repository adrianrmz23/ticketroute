import { notFound } from "next/navigation";

import { calculateEstimate } from "@/application/planning/calculate-estimate";
import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import type { EstimateProposal } from "@/domain/planning/estimate";
import {
  ticketStatusLabels,
  type TicketDraft,
} from "@/domain/tickets/ticket";
import { PlanningLab } from "@/features/planning/components/planning-lab";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export const metadata = { title: "Planning Lab" };

export default async function TicketPlanningPage({
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
    { data: currentEstimate },
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
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  if (!ticket) notFound();

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
  const calculated = calculateEstimate({
    ticket: draft,
    unit: currentWorkspace.estimationUnit,
    weeklyCapacityHours: currentWorkspace.weeklyCapacityHours,
  });

  let proposal: EstimateProposal = calculated;
  if (currentEstimate) {
    const [{ data: factors }, { data: breakdown }] = await Promise.all([
      supabase
        .from("estimate_factors")
        .select("factor_key,label,direction,weight,evidence")
        .eq("estimate_id", currentEstimate.id)
        .order("position"),
      supabase
        .from("estimate_breakdown")
        .select("label,effort_share,basis")
        .eq("estimate_id", currentEstimate.id)
        .order("position"),
    ]);

    proposal = {
      ...calculated,
      unit: currentEstimate.unit,
      scenarios: {
        favorable: {
          ...calculated.scenarios.favorable,
          low: currentEstimate.favorable_low,
          high: currentEstimate.favorable_high,
        },
        probable: {
          ...calculated.scenarios.probable,
          low: currentEstimate.probable_low,
          high: currentEstimate.probable_high,
        },
        adverse: {
          ...calculated.scenarios.adverse,
          low: currentEstimate.adverse_low,
          high: currentEstimate.adverse_high,
        },
      },
      confidence: currentEstimate.confidence,
      basis: currentEstimate.basis,
      assumptions: currentEstimate.assumptions,
      unknowns: currentEstimate.unknowns,
      risks: currentEstimate.risks,
      dependencies: currentEstimate.dependencies_notes,
      historicalReferences: currentEstimate.historical_references,
      factors: (factors ?? []).map((factor) => ({
        key: factor.factor_key,
        label: factor.label,
        direction: factor.direction,
        weight: factor.weight as 1 | 2 | 3,
        evidence: factor.evidence,
      })),
      decomposition: (breakdown ?? []).map((item) => ({
        label: item.label,
        effortShare: item.effort_share,
        basis: item.basis,
      })),
    };
  }

  return (
    <PlanningLab
      ticketId={ticket.id}
      ticketTitle={ticket.title}
      ticketStatus={ticketStatusLabels[ticket.status]}
      initialProposal={proposal}
      confirmedVersion={currentEstimate?.version ?? null}
      confirmedAt={currentEstimate?.created_at ?? null}
    />
  );
}

