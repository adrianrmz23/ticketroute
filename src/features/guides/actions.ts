"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { confirmPlanningGuideSchema } from "@/domain/guides/planning-guide-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { PlanningGuideActionState } from "./guides-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function confirmPlanningGuideAction(
  input: unknown,
): Promise<PlanningGuideActionState> {
  const parsed = confirmPlanningGuideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Revisa responsables, verificaciones y distribución antes de confirmar.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase.rpc("confirm_planning_guide", {
    p_ticket_id: parsed.data.ticketId,
    p_payload: asJson(parsed.data.guide),
  });

  if (error || !data) {
    return {
      status: "error",
      message:
        "No pudimos confirmar la guía. Verifica que la estimación, la asignación y sus integrantes sigan vigentes.",
    };
  }

  revalidatePath(`/app/planning/${parsed.data.ticketId}/guide`);
  revalidatePath(`/app/planning/${parsed.data.ticketId}/assignment`);
  revalidatePath(`/app/planning/${parsed.data.ticketId}`);
  revalidatePath("/app/planning");
  revalidatePath(`/app/tickets/${parsed.data.ticketId}`);
  revalidatePath("/app");

  return {
    status: "success",
    message: "Guía confirmada con responsables, fuentes y comprobaciones visibles.",
    planningGuideId: data,
  };
}
