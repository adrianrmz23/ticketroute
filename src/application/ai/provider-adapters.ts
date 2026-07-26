import "server-only";

import type { AiProvider } from "@/domain/ai/ai-schemas";

export type ProviderConfig = {
  provider: AiProvider;
  model: string;
};

export type CouncilOpinion = {
  position: number;
  provider: AiProvider;
  model: string;
  source: "provider" | "local_fallback" | "manual";
  recommendation: string;
  reasoning: string;
  risks: string[];
  confidence: "low" | "medium" | "high";
};

export type CouncilResult = {
  opinions: CouncilOpinion[];
  providers: AiProvider[];
  synthesis: string;
  limitations: string[];
};

const SYSTEM_INSTRUCTIONS =
  "Actúas como un consejero independiente de producto y ejecución. Responde en español, con una recomendación concreta, razones verificables, riesgos y límites. No inventes datos, no ocultes incertidumbre y no decidas por el usuario. Máximo 500 palabras.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractOpenAiText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.output)) return null;
  const parts: string[] = [];
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      const text = nonEmptyText(content.text);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n").trim() || null;
}

function extractAnthropicText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.content)) return null;
  return (
    payload.content
      .filter(isRecord)
      .map((content) => nonEmptyText(content.text))
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .trim() || null
  );
}

function extractGeminiText(payload: unknown) {
  if (!isRecord(payload)) return null;
  const direct = nonEmptyText(payload.output_text);
  if (direct) return direct;
  if (!Array.isArray(payload.steps)) return null;
  const text: string[] = [];
  for (const step of payload.steps) {
    if (!isRecord(step) || !Array.isArray(step.content)) continue;
    for (const content of step.content) {
      if (!isRecord(content)) continue;
      const value = nonEmptyText(content.text);
      if (value) text.push(value);
    }
  }
  return text.join("\n").trim() || null;
}

function extractChatCompletionText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;
  const first = payload.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;
  return nonEmptyText(first.message.content);
}

function providerKey(provider: AiProvider) {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "kimi":
      return process.env.MOONSHOT_API_KEY ?? process.env.KIMI_API_KEY;
    case "manual":
      return "local";
  }
}

export function hasProviderSecret(provider: AiProvider) {
  return Boolean(providerKey(provider));
}

async function requestProvider(config: ProviderConfig, prompt: string) {
  const key = providerKey(config.provider);
  if (!key || config.provider === "manual") return null;
  const signal = AbortSignal.timeout(30000);

  if (config.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: prompt,
      }),
      signal,
    });
    if (!response.ok) throw new Error(`OpenAI respondió ${response.status}`);
    return extractOpenAiText(await response.json());
  }

  if (config.provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1600,
        system: SYSTEM_INSTRUCTIONS,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Anthropic respondió ${response.status}`);
    }
    return extractAnthropicText(await response.json());
  }

  if (config.provider === "gemini") {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          system_instruction: SYSTEM_INSTRUCTIONS,
          input: prompt,
          store: false,
        }),
        signal,
      },
    );
    if (!response.ok) throw new Error(`Gemini respondió ${response.status}`);
    return extractGeminiText(await response.json());
  }

  const response = await fetch(
    "https://api.moonshot.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTIONS },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 1600,
      }),
      signal,
    },
  );
  if (!response.ok) throw new Error(`Kimi respondió ${response.status}`);
  return extractChatCompletionText(await response.json());
}

const localLenses = [
  {
    name: "viabilidad",
    recommendation:
      "Reduce la decisión a un siguiente paso reversible con criterios de aceptación visibles.",
    risks: ["Supuestos sin validar", "Alcance mayor al declarado"],
  },
  {
    name: "riesgo",
    recommendation:
      "Prueba primero la dependencia de mayor impacto y conserva una salida segura.",
    risks: ["Dependencia externa", "Costo de reversión"],
  },
  {
    name: "capacidad",
    recommendation:
      "Alinea el compromiso con la capacidad declarada y explicita qué quedará fuera.",
    risks: ["Sobrecarga declarada", "Responsabilidad difusa"],
  },
  {
    name: "evidencia",
    recommendation:
      "Define qué observación confirmará el resultado antes de iniciar la ejecución.",
    risks: ["Criterio ambiguo", "Resultado no verificable"],
  },
] as const;

function localOpinion(
  position: number,
  config: ProviderConfig,
  prompt: string,
  reason: string,
): CouncilOpinion {
  const lens = localLenses[(position - 1) % localLenses.length];
  return {
    position,
    provider: config.provider,
    model: "ticketroute-local-v1",
    source: "local_fallback",
    recommendation: lens.recommendation,
    reasoning: `Lectura local de ${lens.name}: la solicitud contiene ${Math.max(
      prompt.trim().split(/\s+/).length,
      1,
    )} palabras. ${reason} Esta salida organiza el criterio; no representa una consulta a ${config.provider}.`,
    risks: [...lens.risks],
    confidence: "low",
  };
}

async function buildOpinion(
  config: ProviderConfig,
  prompt: string,
  position: number,
): Promise<{ opinion: CouncilOpinion; limitation?: string }> {
  if (config.provider === "manual") {
    return {
      opinion: localOpinion(
        position,
        config,
        prompt,
        "Se eligió deliberación local.",
      ),
    };
  }
  if (!hasProviderSecret(config.provider)) {
    return {
      opinion: localOpinion(
        position,
        config,
        prompt,
        "No existe una credencial de servidor configurada.",
      ),
      limitation: `${config.provider}: credencial ausente; se usó fallback local explícito.`,
    };
  }

  try {
    const response = await requestProvider(
      config,
      `Consejo ${position}. Analiza de forma independiente esta decisión:\n\n${prompt}`,
    );
    if (!response) throw new Error("Respuesta vacía");
    return {
      opinion: {
        position,
        provider: config.provider,
        model: config.model,
        source: "provider",
        recommendation: response.slice(0, 6000),
        reasoning: response.slice(0, 12000),
        risks: ["Validar supuestos y límites antes de ejecutar"],
        confidence: "medium",
      },
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Error no clasificado";
    return {
      opinion: localOpinion(position, config, prompt, reason),
      limitation: `${config.provider}: ${reason}; se usó fallback local explícito.`,
    };
  }
}

export async function runCouncil(
  prompt: string,
  configuredProviders: ProviderConfig[],
): Promise<CouncilResult> {
  const configs = configuredProviders.length
    ? configuredProviders.slice(0, 4)
    : (["manual", "manual", "manual"] as AiProvider[]).map(
        (provider, index) => ({
          provider,
          model: `ticketroute-local-${index + 1}`,
        }),
      );
  const outcomes = await Promise.all(
    configs.map((config, index) =>
      buildOpinion(config, prompt, index + 1),
    ),
  );
  const opinions = outcomes.map((outcome) => outcome.opinion);
  const limitations = outcomes
    .map((outcome) => outcome.limitation)
    .filter((value): value is string => Boolean(value));
  const synthesis = [
    "Síntesis trazable: conserva la decisión humana.",
    ...opinions.map(
      (opinion) =>
        `${opinion.position}. ${opinion.recommendation.split("\n")[0]}`,
    ),
    limitations.length
      ? "Una o más voces usaron fallback local; revisa el origen de cada tarjeta."
      : "Todas las voces configuradas respondieron desde su proveedor.",
  ].join("\n");

  return {
    opinions,
    providers: opinions.map((opinion) => opinion.provider),
    synthesis,
    limitations,
  };
}
