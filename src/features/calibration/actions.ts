"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  calibrationRecordSchema,
  parseCalibrationList,
} from "@/domain/calibration/calibration-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { CalibrationActionState } from "./calibration-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function saveCalibrationAction(
  _previousState: CalibrationActionState,
  formData: FormData,
): Promise<CalibrationActionState> {
  const parsed = calibrationRecordSchema.safeParse({
    ticketId: formData.get("ticketId"),
    actualValue: Number(formData.get("actualValue")),
    interruptionCount: Number(formData.get("interruptionCount") ?? 0),
    scopeChanged: formData.get("scopeChanged") === "on",
    unexpectedBlockers: parseCalibrationList(
      formData.get("unexpectedBlockers"),
    ),
    unexpectedDependencies: parseCalibrationList(
      formData.get("unexpectedDependencies"),
    ),
    deviationCause: formData.get("deviationCause"),
    selectedScenario: formData.get("selectedScenario"),
    learningSummary: formData.get("learningSummary"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Revisa la comparación antes de guardarla.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/app/calibration");

  const { ticketId, ...payload } = parsed.data;
  const { error } = await supabase.rpc("save_calibration_record", {
    p_ticket_id: ticketId,
    p_payload: asJson(payload),
  });

  if (error) {
    return {
      status: "error",
      message: error.message.includes("immutable")
        ? "Esta calibración ya fue confirmada y conserva su evidencia."
        : "No pudimos guardar la calibración. Verifica que el recorrido esté completado y que la migración 0010 esté aplicada.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/calibration");
  revalidatePath(`/app/calibration/${ticketId}`);

  return {
    status: "success",
    message:
      parsed.data.status === "confirmed"
        ? "Aprendizaje confirmado y disponible como referencia histórica."
        : "Borrador de calibración guardado.",
  };
}
