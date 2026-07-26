"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  hasProviderSecret,
  runCouncil,
} from "@/application/ai/provider-adapters";
import {
  councilRequestSchema,
  providerConfigSchema,
} from "@/domain/ai/ai-schemas";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import type { AiActionState } from "./ai-state";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function saveProviderConfigAction(
  _previousState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const parsed = providerConfigSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    provider: formData.get("provider"),
    model: formData.get("model"),
    enabled: formData.get("enabled") === "on",
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa el proveedor y el modelo." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/app/settings/ai");

  const { workspaceId, ...config } = parsed.data;
  const { error } = await supabase.rpc("save_ai_provider_config", {
    p_workspace_id: workspaceId,
    p_payload: asJson({
      ...config,
      secretConfigured: hasProviderSecret(config.provider),
    }),
  });

  if (error) {
    return {
      status: "error",
      message:
        "No pudimos guardar el proveedor. Tu rol debe ser Owner o Admin y la migración 0011 debe estar aplicada.",
    };
  }
  revalidatePath("/app/settings/ai");
  revalidatePath("/app/council");
  return {
    status: "success",
    message: hasProviderSecret(config.provider)
      ? "Configuración guardada; la credencial permanece en el servidor."
      : "Configuración guardada. Sin credencial, Council Mode mostrará fallback local.",
  };
}

export async function runCouncilAction(
  _previousState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const parsed = councilRequestSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Escribe un título y una decisión con contexto suficiente.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/app/council");

  const { data: configs, error: configError } = await supabase
    .from("ai_provider_configs")
    .select("provider,model")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("enabled", true)
    .order("is_default", { ascending: false })
    .limit(4);
  if (configError) {
    return {
      status: "error",
      message: "No se pudo leer la configuración de proveedores.",
    };
  }

  const result = await runCouncil(
    parsed.data.prompt,
    (configs ?? []).map((config) => ({
      provider: config.provider,
      model: config.model,
    })),
  );
  const { data: sessionId, error } = await supabase.rpc(
    "save_council_session",
    {
      p_workspace_id: parsed.data.workspaceId,
      p_payload: asJson({
        title: parsed.data.title,
        prompt: parsed.data.prompt,
        ...result,
      }),
    },
  );
  if (error || !sessionId) {
    return {
      status: "error",
      message:
        "El Consejo respondió, pero no pudimos guardar su trazabilidad. Revisa la migración 0011.",
    };
  }

  revalidatePath("/app/council");
  redirect(`/app/council?session=${sessionId}`);
}
