"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  startExecutionSchema,
  updateExecutionStepSchema,
} from "@/domain/execution/execution-schemas";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { ExecutionActionState } from "./execution-state";

function refreshExecution(ticketId: string) {
  revalidatePath("/app");
  revalidatePath("/app/board");
  revalidatePath(`/app/board/${ticketId}`);
  revalidatePath(`/app/planning/${ticketId}/guide`);
  revalidatePath(`/app/tickets/${ticketId}`);
}

export async function startExecutionAction(
  input: unknown,
): Promise<ExecutionActionState> {
  const parsed = startExecutionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "La guía o el ticket no son válidos." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase.rpc("start_execution_run", {
    p_ticket_id: parsed.data.ticketId,
    p_planning_guide_id: parsed.data.guideId,
  });

  if (error || !data) {
    return {
      status: "error",
      message:
        "No se pudo iniciar el recorrido. Confirma que la guía siga vigente y que no exista otra ejecución abierta.",
    };
  }

  refreshExecution(parsed.data.ticketId);
  return {
    status: "success",
    message: "Recorrido iniciado desde una copia verificable de la guía.",
    executionRunId: data,
  };
}

export async function updateExecutionStepAction(
  input: unknown,
): Promise<ExecutionActionState> {
  const parsed = updateExecutionStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Revisa la transición y su evidencia.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase.rpc("update_execution_step", {
    p_execution_step_id: parsed.data.executionStepId,
    p_status: parsed.data.status,
    p_evidence_note: parsed.data.evidenceNote,
    p_blocker_note: parsed.data.blockerNote,
  });

  if (error || !data) {
    return {
      status: "error",
      message:
        "No se pudo registrar el cambio. Verifica tu rol, el responsable del paso y que la ejecución siga abierta.",
    };
  }

  refreshExecution(parsed.data.ticketId);
  return {
    status: "success",
    message: "Estado declarado y trazabilidad actualizada.",
  };
}
