"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  integrationSchema,
  notificationPreferencesSchema,
  privacyRequestSchema,
  privacyResolutionSchema,
  type IntegrationProvider,
} from "@/domain/system/system-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { SystemActionState } from "./system-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function integrationSecretConfigured(provider: IntegrationProvider) {
  const values: Record<IntegrationProvider, string | undefined> = {
    webhook: process.env.TICKETROUTE_WEBHOOK_URL,
    slack: process.env.SLACK_WEBHOOK_URL,
    github: process.env.GITHUB_TOKEN,
    linear: process.env.LINEAR_API_KEY,
    jira: process.env.JIRA_API_TOKEN,
  };
  return Boolean(values[provider]);
}

async function requireUser(next: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return supabase;
}

export async function saveNotificationPreferencesAction(
  _previousState: SystemActionState,
  formData: FormData,
): Promise<SystemActionState> {
  const parsed = notificationPreferencesSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    inApp: formData.get("inApp") === "on",
    email: formData.get("email") === "on",
    blockedSteps: formData.get("blockedSteps") === "on",
    assignments: formData.get("assignments") === "on",
    invitations: formData.get("invitations") === "on",
    councilResults: formData.get("councilResults") === "on",
    digestFrequency: formData.get("digestFrequency"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa las preferencias." };
  }
  const supabase = await requireUser("/app/notifications");
  const { workspaceId, ...payload } = parsed.data;
  const emailAvailable = Boolean(
    process.env.NOTIFICATION_EMAIL_WEBHOOK_URL,
  );
  const { error } = await supabase.rpc("save_notification_preferences", {
    p_workspace_id: workspaceId,
    p_payload: asJson({
      ...payload,
      email: payload.email && emailAvailable,
      digestFrequency: emailAvailable ? payload.digestFrequency : "never",
    }),
  });
  if (error) {
    return {
      status: "error",
      message: "No se pudieron guardar. Verifica la migración 0012.",
    };
  }
  revalidatePath("/app/notifications");
  return { status: "success", message: "Preferencias guardadas." };
}

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return;
  const supabase = await requireUser("/app/notifications");
  await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  revalidatePath("/app/notifications");
}

export async function saveIntegrationAction(
  _previousState: SystemActionState,
  formData: FormData,
): Promise<SystemActionState> {
  const parsed = integrationSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    provider: formData.get("provider"),
    displayName: formData.get("displayName"),
    endpoint: formData.get("endpoint"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Revisa la configuración de la integración.",
    };
  }
  const supabase = await requireUser("/app/integrations");
  const { workspaceId, ...payload } = parsed.data;
  const safePayload = {
    ...payload,
    endpoint:
      payload.provider === "webhook" || payload.provider === "slack"
        ? ""
        : payload.endpoint,
  };
  const { error } = await supabase.rpc("save_workspace_integration", {
    p_workspace_id: workspaceId,
    p_payload: asJson({
      ...safePayload,
      secretConfigured: integrationSecretConfigured(payload.provider),
      settings: {},
    }),
  });
  if (error) {
    return {
      status: "error",
      message:
        "No se pudo guardar. Tu rol debe ser Owner o Admin y la migración 0012 debe estar aplicada.",
    };
  }
  revalidatePath("/app/integrations");
  return {
    status: "success",
    message: integrationSecretConfigured(payload.provider)
      ? "Integración guardada con credencial privada detectada."
      : "Integración guardada en modo seguro; falta la credencial del servidor.",
  };
}

export async function createPrivacyRequestAction(
  _previousState: SystemActionState,
  formData: FormData,
): Promise<SystemActionState> {
  const parsed = privacyRequestSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    requestType: formData.get("requestType"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa la solicitud." };
  }
  const supabase = await requireUser("/app/settings/security");
  const { data, error } = await supabase.rpc("create_privacy_request", {
    p_workspace_id: parsed.data.workspaceId,
    p_request_type: parsed.data.requestType,
    p_details: parsed.data.details,
  });
  if (error || !data) {
    return {
      status: "error",
      message: "No se pudo registrar. Verifica la migración 0013.",
    };
  }
  revalidatePath("/app/settings/security");
  return {
    status: "success",
    message: "Solicitud registrada con trazabilidad.",
  };
}

export async function resolvePrivacyRequestAction(formData: FormData) {
  const parsed = privacyResolutionSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    resolutionNote: formData.get("resolutionNote"),
  });
  if (!parsed.success) return;
  const supabase = await requireUser("/app/settings/security");
  await supabase.rpc("resolve_privacy_request", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
    p_resolution_note: parsed.data.resolutionNote,
  });
  revalidatePath("/app/settings/security");
}
