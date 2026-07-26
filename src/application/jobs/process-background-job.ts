import "server-only";

import type {
  BackgroundJobType,
  Database,
  Json,
} from "@/infrastructure/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Job = Database["public"]["Tables"]["background_jobs"]["Row"];

function asRecord(value: Json): Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
}

function textValue(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

async function finish(
  client: SupabaseClient<Database>,
  job: Job,
  status: "completed" | "failed",
  result: Json,
  error = "",
) {
  await client.rpc("finish_background_job", {
    p_job_id: job.id,
    p_status: status,
    p_result: result,
    p_error: error,
  });
}

async function notifyCreator(
  client: SupabaseClient<Database>,
  job: Job,
  title: string,
  body: string,
  href: string,
) {
  if (!job.workspace_id || !job.created_by) return;
  await client.from("notifications").insert({
    workspace_id: job.workspace_id,
    user_id: job.created_by,
    kind: "job_completed",
    title,
    body,
    href,
    metadata: { background_job_id: job.id },
  });
}

async function processPrivacyJob(
  client: SupabaseClient<Database>,
  job: Job,
  type: Extract<BackgroundJobType, "privacy_export" | "privacy_delete">,
) {
  const payload = asRecord(job.payload);
  const requestId = textValue(payload.privacy_request_id);
  if (!requestId) throw new Error("privacy_request_id ausente");
  if (type === "privacy_export") {
    const href = `/api/privacy/export/${requestId}`;
    await finish(client, job, "completed", {
      ready: true,
      download: href,
    });
    await client
      .from("privacy_requests")
      .update({
        status: "completed",
        resolution_note:
          "Exportación preparada. El contenido se genera bajo la sesión autenticada.",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    await notifyCreator(
      client,
      job,
      "Exportación disponible",
      "Tu paquete de datos ya puede descargarse.",
      href,
    );
    return;
  }

  await finish(client, job, "completed", {
    requires_manual_approval: true,
  });
  await client
    .from("privacy_requests")
    .update({
      status: "processing",
      resolution_note:
        "Solicitud validada y pendiente de aprobación administrativa irreversible.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  await notifyCreator(
    client,
    job,
    "Eliminación en revisión",
    "La solicitud superó la validación automática y requiere aprobación administrativa.",
    "/app/settings/security",
  );
}

function integrationSecret(provider: string) {
  switch (provider) {
    case "webhook":
      return process.env.TICKETROUTE_WEBHOOK_URL;
    case "slack":
      return process.env.SLACK_WEBHOOK_URL;
    case "github":
      return process.env.GITHUB_TOKEN;
    case "linear":
      return process.env.LINEAR_API_KEY;
    case "jira":
      return process.env.JIRA_API_TOKEN;
    default:
      return undefined;
  }
}

async function deliverIntegration(
  client: SupabaseClient<Database>,
  job: Job,
) {
  const eventId = textValue(asRecord(job.payload).integration_event_id);
  if (!eventId) throw new Error("integration_event_id ausente");
  const { data: event } = await client
    .from("integration_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Evento de integración inexistente");
  const { data: integration } = await client
    .from("workspace_integrations")
    .select("*")
    .eq("id", event.integration_id)
    .maybeSingle();
  if (!integration || !integration.enabled) {
    throw new Error("Integración deshabilitada o inexistente");
  }
  const secret = integrationSecret(integration.provider);
  if (!secret) throw new Error("Credencial privada ausente");

  let endpoint = integration.endpoint;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let body: Json = {
    event: event.event_type,
    payload: event.payload,
  };
  if (integration.provider === "webhook") {
    endpoint = process.env.TICKETROUTE_WEBHOOK_URL ?? endpoint;
  } else if (integration.provider === "slack") {
    endpoint = process.env.SLACK_WEBHOOK_URL ?? endpoint;
    body = {
      text: `TicketRoute · ${event.event_type}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*TicketRoute* · ${event.event_type}`,
          },
        },
      ],
    };
  } else {
    headers.Authorization = `Bearer ${secret}`;
  }
  if (!endpoint) throw new Error("Endpoint de entrega ausente");

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Destino respondió ${response.status}`);
  }
  await client
    .from("integration_events")
    .update({
      status: "delivered",
      attempt_count: event.attempt_count + 1,
      processed_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  await finish(client, job, "completed", { delivered: true });
}

async function deliverNotificationEmail(
  client: SupabaseClient<Database>,
  job: Job,
) {
  const notificationId = textValue(asRecord(job.payload).notification_id);
  if (!notificationId) throw new Error("notification_id ausente");
  const endpoint = process.env.NOTIFICATION_EMAIL_WEBHOOK_URL;
  if (!endpoint) {
    throw new Error("NOTIFICATION_EMAIL_WEBHOOK_URL no está configurada");
  }
  const { data: notification } = await client
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .maybeSingle();
  if (!notification) throw new Error("Notificación inexistente");

  const {
    data: { user },
    error: userError,
  } = await client.auth.admin.getUserById(notification.user_id);
  if (userError || !user?.email) {
    throw new Error("El destinatario no tiene correo verificable");
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const href = notification.href
    ? `${siteUrl}${notification.href}`
    : siteUrl;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = process.env.NOTIFICATION_EMAIL_WEBHOOK_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: user.email,
      subject: `TicketRoute · ${notification.title}`,
      text: [notification.body, href].filter(Boolean).join("\n\n"),
      notification: {
        id: notification.id,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        href,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Entrega de correo respondió ${response.status}`);
  }
  await finish(client, job, "completed", {
    delivered: true,
    notification_id: notification.id,
  });
}

export async function processBackgroundJob(
  client: SupabaseClient<Database>,
  job: Job,
) {
  try {
    if (job.job_type === "privacy_export" || job.job_type === "privacy_delete") {
      await processPrivacyJob(client, job, job.job_type);
      return;
    }
    if (job.job_type === "integration_delivery") {
      await deliverIntegration(client, job);
      return;
    }
    if (job.job_type === "notification_digest") {
      await deliverNotificationEmail(client, job);
      return;
    }
    await finish(client, job, "completed", {
      skipped: true,
      reason: "No hay trabajo pendiente para este tipo en esta ejecución.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error no clasificado";
    await finish(client, job, "failed", {}, message);
    if (job.job_type === "integration_delivery") {
      const eventId = textValue(asRecord(job.payload).integration_event_id);
      if (eventId) {
        const { data: event } = await client
          .from("integration_events")
          .select("attempt_count")
          .eq("id", eventId)
          .maybeSingle();
        await client
          .from("integration_events")
          .update({
            status: "failed",
            attempt_count: (event?.attempt_count ?? 0) + 1,
            last_error: message,
            processed_at: new Date().toISOString(),
          })
          .eq("id", eventId);
      }
    }
  }
}
