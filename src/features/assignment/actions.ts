"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { confirmAssignmentSchema } from "@/domain/assignment/assignment-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { AssignmentActionState } from "./assignment-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function confirmAssignmentAction(
  input: unknown,
): Promise<AssignmentActionState> {
  const parsed = confirmAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Revisa personas, contribuciones y rango antes de confirmar.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase.rpc("confirm_assignment_plan", {
    p_ticket_id: parsed.data.ticketId,
    p_payload: asJson(parsed.data.scenario),
  });

  if (error || !data) {
    return {
      status: "error",
      message:
        "No pudimos confirmar el plan. Verifica la estimación vigente y que todas las personas sigan en el workspace.",
    };
  }

  revalidatePath(`/app/planning/${parsed.data.ticketId}/assignment`);
  revalidatePath(`/app/planning/${parsed.data.ticketId}`);
  revalidatePath("/app/planning");
  revalidatePath(`/app/tickets/${parsed.data.ticketId}`);
  revalidatePath("/app");

  return {
    status: "success",
    message: "Asignación confirmada con razones y consecuencias trazables.",
    assignmentPlanId: data,
  };
}

