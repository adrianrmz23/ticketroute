"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createTicketFromCaptureSchema,
  updateTicketSchema,
} from "@/domain/tickets/ticket-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { TicketActionState } from "./ticket-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function requireClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }
  return supabase;
}

export async function createTicketFromCaptureAction(input: unknown) {
  const parsed = createTicketFromCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error" as const,
      message: parsed.error.issues[0]?.message ?? "Revisa el borrador.",
    };
  }

  const supabase = await requireClient();
  const { data, error } = await supabase.rpc("create_ticket_from_capture", {
    p_workspace_id: parsed.data.workspaceId,
    p_capture_id: parsed.data.captureId,
    p_payload: asJson(parsed.data.draft),
  });

  if (error || !data) {
    return {
      status: "error" as const,
      message: "No pudimos confirmar el ticket. Revisa la entrada e inténtalo.",
    };
  }

  revalidatePath("/app", "layout");
  redirect(`/app/tickets/${data}`);
}

export async function updateTicketAction(
  input: unknown,
): Promise<TicketActionState> {
  const parsed = updateTicketSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisa el ticket.",
    };
  }

  const supabase = await requireClient();
  const { error } = await supabase.rpc("update_ticket_draft", {
    p_ticket_id: parsed.data.ticketId,
    p_payload: asJson(parsed.data.draft),
    p_change_summary: parsed.data.changeSummary,
  });

  if (error) {
    return {
      status: "error",
      message: "No pudimos guardar esta revisión.",
    };
  }

  revalidatePath(`/app/tickets/${parsed.data.ticketId}`);
  revalidatePath("/app/tickets");
  revalidatePath("/app");
  return {
    status: "success",
    message: "Revisión guardada.",
    savedAt: new Date().toISOString(),
  };
}
