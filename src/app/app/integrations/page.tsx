import { Blocks, KeyRound, ShieldCheck } from "lucide-react";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import {
  integrationProviders,
  type IntegrationProvider,
} from "@/domain/system/system-schemas";
import { IntegrationForm } from "@/features/system/components/integration-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Integraciones" };

export default async function IntegrationsPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: integrations, error }, { data: events }] = currentWorkspace
    ? await Promise.all([
        supabase
          .from("workspace_integrations")
          .select("*")
          .eq("workspace_id", currentWorkspace.id),
        supabase
          .from("integration_events")
          .select("id,status,event_type,created_at")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ])
    : [{ data: [] }, { data: [] }];
  if (error) {
    throw new Error(
      "No se pudieron cargar las integraciones. Ejecuta la migración 0012.",
    );
  }
  const byProvider = new Map(
    (integrations ?? []).map((item) => [item.provider, item]),
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SISTEMA / CONECTORES</p>
          <h1>Salir del producto con una frontera visible.</h1>
          <p className={styles.heroText}>
            Cada integración declara su destino, credencial y estado. Los
            eventos se encolan para no bloquear la experiencia principal.
          </p>
        </div>
        <div className={styles.stamp}>
          <Blocks size={20} />
          <span><strong>{integrations?.filter((item) => item.enabled).length ?? 0}</strong>Activas</span>
        </div>
      </header>
      <section className={styles.darkCard}>
        <p className={styles.sectionLabel}>LÍMITE OPERATIVO</p>
        <h2>Metadatos en base, secretos en servidor.</h2>
        <div className={styles.darkList}>
          <div><KeyRound size={15} /><span><strong>Credenciales privadas</strong><small>Los tokens nunca viajan en formularios ni se escriben en PostgreSQL.</small></span></div>
          <div><ShieldCheck size={15} /><span><strong>Entrega asíncrona</strong><small>La cola conserva intentos y errores sin bloquear al usuario.</small></span></div>
        </div>
      </section>
      <div className={styles.grid}>
        {integrationProviders.map((provider) => {
          const integration = byProvider.get(provider as IntegrationProvider);
          return (
            <IntegrationForm
              workspaceId={currentWorkspace?.id ?? ""}
              provider={provider}
              integration={
                integration
                  ? {
                      displayName: integration.display_name,
                      endpoint: integration.endpoint,
                      enabled: integration.enabled,
                      secretConfigured: integration.secret_configured,
                    }
                  : undefined
              }
              key={provider}
            />
          );
        })}
      </div>
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div><p>EVENTOS</p><h2>Historial de entrega</h2></div>
          <span>{events?.length ?? 0} visibles</span>
        </header>
        <div className={styles.list}>
          {(events ?? []).map((event) => (
            <div className={styles.listItem} key={event.id}>
              <Blocks size={15} />
              <div><strong>{event.event_type}</strong><small>{event.created_at}</small></div>
              <span className={styles.chip}>{event.status}</span>
            </div>
          ))}
          {!events?.length && (
            <div className={styles.empty}>No hay entregas encoladas todavía.</div>
          )}
        </div>
      </section>
    </div>
  );
}
