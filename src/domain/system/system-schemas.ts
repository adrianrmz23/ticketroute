import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  workspaceId: z.uuid(),
  inApp: z.boolean(),
  email: z.boolean(),
  blockedSteps: z.boolean(),
  assignments: z.boolean(),
  invitations: z.boolean(),
  councilResults: z.boolean(),
  digestFrequency: z.enum(["never", "daily", "weekly"]),
});

export const integrationProviders = [
  "webhook",
  "slack",
  "github",
  "linear",
  "jira",
] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];

export const integrationLabels: Record<IntegrationProvider, string> = {
  webhook: "Webhook genérico",
  slack: "Slack",
  github: "GitHub",
  linear: "Linear",
  jira: "Jira",
};

export const integrationSchema = z.object({
  workspaceId: z.uuid(),
  provider: z.enum(integrationProviders),
  displayName: z.string().trim().min(2).max(120),
  endpoint: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    }, "Usa una URL HTTPS sin credenciales, query ni fragmento."),
  enabled: z.boolean(),
});

export const privacyRequestSchema = z.object({
  workspaceId: z.uuid(),
  requestType: z.enum(["export", "delete", "correct"]),
  details: z.string().trim().max(3000),
});

export const privacyResolutionSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(["processing", "completed", "rejected"]),
  resolutionNote: z.string().trim().max(3000),
});
