"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveEstimateSchema } from "@/domain/planning/estimate-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { EstimateActionState } from "./planning-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function saveEstimateAction(
  input: unknown,
): Promise<EstimateActionState> {
  const parsed = saveEstimateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Revisa los rangos antes de confirmar.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase.rpc("save_ticket_estimate", {
    p_ticket_id: parsed.data.ticketId,
    p_payload: asJson(parsed.data.proposal),
  });

  if (error || !data) {
    return {
      status: "error",
      message:
        "No pudimos confirmar la estimación. Verifica los rangos e inténtalo otra vez.",
    };
  }

  revalidatePath(`/app/planning/${parsed.data.ticketId}`);
  revalidatePath("/app/planning");
  revalidatePath(`/app/tickets/${parsed.data.ticketId}`);
  revalidatePath("/app");

  return {
    status: "success",
    message: "Estimación confirmada y trazable.",
    estimateId: data,
  };
}

