import { Bot, Scale, ShieldCheck } from "lucide-react";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { providerLabels } from "@/domain/ai/ai-schemas";
import { CouncilForm } from "@/features/ai/components/council-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Council Mode" };

export default async function CouncilPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: sessions, error }, { data: configs }] = currentWorkspace
    ? await Promise.all([
        supabase
          .from("council_sessions")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("ai_provider_configs")
          .select("provider,enabled,secret_configured")
          .eq("workspace_id", currentWorkspace.id),
      ])
    : [{ data: [] }, { data: [] }];
  if (error) {
    throw new Error("No se pudo abrir Council Mode. Ejecuta la migración 0011.");
  }
  const selected =
    (sessions ?? []).find((session) => session.id === sessionId) ??
    (sessionId
      ? (
          await supabase
            .from("council_sessions")
            .select("*")
            .eq("id", sessionId)
            .eq("workspace_id", currentWorkspace?.id ?? "")
            .maybeSingle()
        ).data
      : null);
  const { data: opinions } = selected
    ? await supabase
        .from("council_opinions")
        .select("*")
        .eq("council_session_id", selected.id)
        .order("position")
    : { data: [] };
  const activeProviders = (configs ?? []).filter((config) => config.enabled);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>DECISIÓN / CONSEJO</p>
          <h1>Varias perspectivas, una decisión humana.</h1>
          <p className={styles.heroText}>
            Council Mode separa opiniones, riesgos y límites. Cada tarjeta
            declara si proviene de un modelo externo o del fallback local.
          </p>
        </div>
        <div className={styles.stamp}>
          <Scale size={20} />
          <span><strong>{activeProviders.length || "L"}</strong>Voces activas</span>
        </div>
      </header>

      <div className={styles.split}>
        <CouncilForm workspaceId={currentWorkspace?.id ?? ""} />
        <aside className={styles.darkCard}>
          <p className={styles.sectionLabel}>CONTRATO DEL CONSEJO</p>
          <h2>Independencia y procedencia</h2>
          <div className={styles.darkList}>
            <div><Bot size={15} /><span><strong>Una consulta por voz</strong><small>No se comparten respuestas entre proveedores.</small></span></div>
            <div><ShieldCheck size={15} /><span><strong>Sin autoridad automática</strong><small>La síntesis no ejecuta cambios ni confirma decisiones.</small></span></div>
          </div>
        </aside>
      </div>

      {selected && (
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <p>02 / RESULTADO TRAZABLE</p>
              <h2>{selected.title}</h2>
            </div>
            <span>{opinions?.length ?? 0} opiniones</span>
          </header>
          <div className={styles.opinionGrid}>
            {(opinions ?? []).map((opinion) => (
              <article className={styles.opinion} key={opinion.id}>
                <header>
                  <strong>{providerLabels[opinion.provider]}</strong>
                  <span className={styles.chip}>
                    {opinion.source === "provider"
                      ? "Proveedor"
                      : "Fallback local"}
                  </span>
                </header>
                <p>{opinion.recommendation}</p>
                <small className={styles.muted}>
                  {opinion.model} · Confianza {opinion.confidence}
                </small>
              </article>
            ))}
          </div>
          <div className={styles.status}>
            <strong>Síntesis</strong>
            <p>{selected.synthesis}</p>
            {selected.limitations.length > 0 && (
              <small>{selected.limitations.join(" · ")}</small>
            )}
          </div>
        </section>
      )}

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div><p>03 / HISTORIAL</p><h2>Consejos anteriores</h2></div>
          <span>{sessions?.length ?? 0} sesiones</span>
        </header>
        <div className={styles.list}>
          {(sessions ?? []).map((session) => (
            <a className={styles.listItem} href={`?session=${session.id}`} key={session.id}>
              <Scale size={16} />
              <div><strong>{session.title}</strong><small>{session.providers.join(" · ")}</small></div>
              <span className={styles.chip}>{session.status}</span>
            </a>
          ))}
          {!sessions?.length && (
            <div className={styles.empty}>Todavía no existe una deliberación guardada.</div>
          )}
        </div>
      </section>
    </div>
  );
}
