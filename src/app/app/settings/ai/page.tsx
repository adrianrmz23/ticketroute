import { Bot, KeyRound, ShieldCheck } from "lucide-react";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { aiProviders, type AiProvider } from "@/domain/ai/ai-schemas";
import { ProviderConfigForm } from "@/features/ai/components/provider-config-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Proveedores de IA" };

export default async function AiProvidersPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const { data: configs, error } = currentWorkspace
    ? await supabase
        .from("ai_provider_configs")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("provider")
    : { data: [] };
  if (error) {
    throw new Error(
      "No se pudieron cargar los proveedores. Ejecuta la migración 0011.",
    );
  }
  const configByProvider = new Map(
    (configs ?? []).map((config) => [config.provider, config]),
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SISTEMA / MULTIPROVEEDOR</p>
          <h1>Elegir modelos sin entregar las llaves al navegador.</h1>
          <p className={styles.heroText}>
            Los adaptadores comparten un contrato y conservan el origen de
            cada respuesta. Las credenciales viven únicamente en variables
            privadas del servidor.
          </p>
        </div>
        <div className={styles.stamp}>
          <Bot size={20} />
          <span><strong>{configs?.filter((item) => item.enabled).length ?? 0}</strong>Activos</span>
        </div>
      </header>

      <section className={styles.darkCard}>
        <p className={styles.sectionLabel}>FRONTERA DE CREDENCIALES</p>
        <h2>Supabase conserva metadatos, nunca API keys.</h2>
        <div className={styles.darkList}>
          <div><KeyRound size={15} /><span><strong>Variables privadas</strong><small>OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY y MOONSHOT_API_KEY.</small></span></div>
          <div><ShieldCheck size={15} /><span><strong>Fallback visible</strong><small>Si falta una clave o falla un proveedor, Council Mode identifica la salida local.</small></span></div>
        </div>
      </section>

      <div className={styles.grid}>
        {aiProviders.map((provider) => {
          const config = configByProvider.get(provider as AiProvider);
          return (
            <ProviderConfigForm
              workspaceId={currentWorkspace?.id ?? ""}
              provider={provider}
              config={
                config
                  ? {
                      model: config.model,
                      enabled: config.enabled,
                      isDefault: config.is_default,
                      secretConfigured: config.secret_configured,
                    }
                  : undefined
              }
              key={provider}
            />
          );
        })}
      </div>
    </div>
  );
}
