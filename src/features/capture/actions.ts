"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  archiveCaptureSchema,
  captureConsentSchema,
  saveCaptureSchema,
} from "@/domain/capture/capture-schemas";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { CaptureActionState } from "./capture-state";

async function requireClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/app/capture");
  }

  return supabase;
}

function safeError(message: string): CaptureActionState {
  const normalized = message.toLowerCase();

  if (normalized.includes("more context")) {
    return {
      status: "error",
      message: "Agrega un poco más de contexto antes de continuar.",
    };
  }

  if (normalized.includes("access denied")) {
    return {
      status: "error",
      message: "Tu rol no permite modificar capturas.",
    };
  }

  return {
    status: "error",
    message: "No pudimos guardar la captura. Inténtalo nuevamente.",
  };
}

export async function saveCaptureAction(
  input: unknown,
): Promise<CaptureActionState> {
  const parsed = saveCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Revisa el contenido de la captura.",
    };
  }

  const supabase = await requireClient();
  const { data, error } = await supabase.rpc("save_capture_session", {
    p_capture_id: parsed.data.id,
    p_workspace_id: parsed.data.workspaceId,
    p_mode: parsed.data.mode,
    p_input_text: parsed.data.inputText,
    p_status: parsed.data.status,
    p_source: parsed.data.source,
    p_metadata: {
      character_count: parsed.data.inputText.length,
      client: "capture_hub",
    },
  });

  if (error || !data) {
    return safeError(error?.message ?? "Capture save failed");
  }

  revalidatePath("/app/capture");
  revalidatePath("/app");

  return {
    status: "success",
    message:
      parsed.data.status === "ready"
        ? "Entrada lista para organizar."
        : "Borrador guardado.",
    captureId: data,
    savedAt: new Date().toISOString(),
  };
}

export async function archiveCaptureAction(
  input: unknown,
): Promise<CaptureActionState> {
  const parsed = archiveCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "La captura no es válida." };
  }

  const supabase = await requireClient();
  const { error } = await supabase.rpc("archive_capture_session", {
    p_capture_id: parsed.data.id,
  });

  if (error) {
    return safeError(error.message);
  }

  revalidatePath("/app/capture");
  revalidatePath("/app");
  return { status: "success", message: "Captura archivada." };
}

export async function recordMicrophoneConsentAction(
  input: unknown,
): Promise<CaptureActionState> {
  const parsed = captureConsentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "No se pudo registrar la decisión." };
  }

  const supabase = await requireClient();
  const { error } = await supabase.rpc("record_capture_consent", {
    p_workspace_id: parsed.data.workspaceId,
    p_capture_session_id: parsed.data.captureId,
    p_consent_type: "microphone",
    p_decision: parsed.data.decision,
    p_metadata: {
      audio_persisted: false,
      transcription_engine: "browser",
    },
  });

  if (error) {
    return safeError(error.message);
  }

  return {
    status: "success",
    message: "Preferencia de micrófono registrada.",
  };
}
