"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  parseDeclaredList,
  planningProfileSchema,
} from "@/domain/capacity/capacity-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { CapacityActionState } from "./capacity-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function savePlanningProfileAction(
  _previousState: CapacityActionState,
  formData: FormData,
): Promise<CapacityActionState> {
  const availabilityValue = String(
    formData.get("availabilityHours") ?? "",
  ).trim();
  const parsed = planningProfileSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
    availabilityHours: availabilityValue
      ? Number(availabilityValue)
      : null,
    plannedHours: Number(formData.get("plannedHours") ?? 0),
    skills: parseDeclaredList(formData.get("skills")),
    componentExperience: parseDeclaredList(
      formData.get("componentExperience"),
    ),
    technicalOwnership: parseDeclaredList(
      formData.get("technicalOwnership"),
    ),
    learningGoals: parseDeclaredList(formData.get("learningGoals")),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa horas y señales antes de guardar.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/app/team/capacity");
  }

  const { workspaceId, userId, ...payload } = parsed.data;
  const { error } = await supabase.rpc("save_member_planning_profile", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_payload: asJson(payload),
  });

  if (error) {
    const denied = error.message.toLowerCase().includes("access denied");
    return {
      status: "error",
      message: denied
        ? "Tu rol no permite editar este perfil."
        : "No pudimos guardar la declaración. Verifica la migración del Bloque 10.",
    };
  }

  revalidatePath("/app/team/capacity");
  revalidatePath("/app/planning");
  revalidatePath("/app");

  return {
    status: "success",
    message: "Capacidad y señales declaradas guardadas.",
  };
}

