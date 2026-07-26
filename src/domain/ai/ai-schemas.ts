import { z } from "zod";

export const aiProviders = [
  "openai",
  "anthropic",
  "gemini",
  "kimi",
  "manual",
] as const;

export type AiProvider = (typeof aiProviders)[number];

export const providerLabels: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  kimi: "Kimi",
  manual: "Motor local",
};

export const providerDefaults: Record<AiProvider, string> = {
  openai: "gpt-5.6",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-3.6-flash",
  kimi: "kimi-k3",
  manual: "ticketroute-local-v1",
};

export const providerConfigSchema = z.object({
  workspaceId: z.uuid(),
  provider: z.enum(aiProviders),
  model: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  isDefault: z.boolean(),
});

export const councilRequestSchema = z.object({
  workspaceId: z.uuid(),
  title: z.string().trim().min(3).max(160),
  prompt: z.string().trim().min(10).max(12000),
});
