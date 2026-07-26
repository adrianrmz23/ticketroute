import { notFound } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import type { TicketDraft } from "@/domain/tickets/ticket";
import { TicketEditor } from "@/features/tickets/components/ticket-editor";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: ticket }, { data: criteria }, { data: subtasks }, { count }] =
    await Promise.all([
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
        .from("ticket_revisions")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", ticketId),
    ]);

  if (!ticket) notFound();

  const { data: capture } = ticket.source_capture_id
    ? await supabase
        .from("capture_sessions")
        .select("input_text")
        .eq("id", ticket.source_capture_id)
        .maybeSingle()
    : { data: null };

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

  return (
    <TicketEditor
      variant="edit"
      workspaceId={currentWorkspace.id}
      ticketId={ticket.id}
      originalInput={capture?.input_text ?? "Ticket creado manualmente."}
      initialDraft={draft}
      revisionCount={count ?? 1}
    />
  );
}
