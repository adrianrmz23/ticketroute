import { FileClock, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { resolvePrivacyRequestAction } from "@/features/system/actions";
import { PrivacyRequestForm } from "@/features/system/components/privacy-request-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Seguridad y privacidad" };

export default async function SecurityPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/app/settings/security");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding");
  const canManage = ["owner", "admin"].includes(currentWorkspace.role);

  const [
    { data: requests, error },
    { data: auditEvents },
    { data: jobs },
  ] = await Promise.all([
    supabase
      .from("privacy_requests")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("audit_events")
      .select("id,action,entity_type,created_at")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(25),
    canManage
      ? supabase
          .from("background_jobs")
          .select("id,job_type,status,attempt_count,created_at,last_error")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) {
    throw new Error(
      "No se pudo cargar el centro de privacidad. Ejecuta la migración 0013.",
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SISTEMA / GOBIERNO</p>
          <h1>Privacidad accionable y trazabilidad mínima.</h1>
          <p className={styles.heroText}>
            Exportación, corrección y eliminación siguen un registro
            verificable. Los eventos de auditoría conservan quién hizo qué,
            sin copiar el contenido sensible completo.
          </p>
        </div>
        <div className={styles.stamp}>
          <ShieldCheck size={20} />
          <span><strong>13</strong>Frontera activa</span>
        </div>
      </header>

      <div className={styles.split}>
        <PrivacyRequestForm workspaceId={currentWorkspace.id} />
        <aside className={styles.darkCard}>
          <p className={styles.sectionLabel}>CONTROLES</p>
          <h2>Defensa por capas</h2>
          <div className={styles.darkList}>
            <div><LockKeyhole size={15} /><span><strong>RLS multiworkspace</strong><small>Cada lectura vuelve a comprobar membresía.</small></span></div>
            <div><FileClock size={15} /><span><strong>Cola restringida</strong><small>Solo service role puede reclamar trabajos asíncronos.</small></span></div>
          </div>
        </aside>
      </div>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div><p>02 / SOLICITUDES</p><h2>Estado y resolución</h2></div>
          <span>{requests?.length ?? 0} registros</span>
        </header>
        <div className={styles.list}>
          {(requests ?? []).map((request) => (
            <article className={styles.listItem} key={request.id}>
              <FileClock size={15} />
              <div>
                <strong>{request.request_type}</strong>
                <small>{request.details || "Sin detalles adicionales"}</small>
              </div>
              <div>
                {request.request_type === "export" &&
                  request.status === "completed" &&
                  request.requested_by === user.id && (
                    <Link
                      className={styles.secondaryButton}
                      href={`/api/privacy/export/${request.id}`}
                    >
                      Descargar JSON
                    </Link>
                  )}
                {canManage && request.status === "pending" && (
                  <>
                    <form action={resolvePrivacyRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        type="hidden"
                        name="resolutionNote"
                        value="Revisión iniciada desde el centro de gobierno."
                      />
                      <button
                        className={styles.secondaryButton}
                        name="status"
                        value="processing"
                      >
                        Iniciar revisión
                      </button>
                    </form>
                    <form action={resolvePrivacyRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        type="hidden"
                        name="resolutionNote"
                        value="Solicitud rechazada por administración."
                      />
                      <button
                        className={styles.secondaryButton}
                        name="status"
                        value="rejected"
                      >
                        Rechazar
                      </button>
                    </form>
                  </>
                )}
                {canManage &&
                  request.status === "processing" &&
                  request.request_type === "correct" && (
                    <form action={resolvePrivacyRequestAction}>
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <input
                        type="hidden"
                        name="resolutionNote"
                        value="Corrección verificada y cerrada por administración."
                      />
                      <button
                        className={styles.secondaryButton}
                        name="status"
                        value="completed"
                      >
                        Marcar corregida
                      </button>
                    </form>
                  )}
                <span className={styles.chip}>{request.status}</span>
              </div>
            </article>
          ))}
          {!requests?.length && (
            <div className={styles.empty}>No hay solicitudes registradas.</div>
          )}
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div><p>03 / AUDITORÍA</p><h2>Eventos recientes</h2></div>
            <span>Metadatos mínimos</span>
          </header>
          <div className={styles.list}>
            {(auditEvents ?? []).map((event) => (
              <div className={styles.listItem} key={event.id}>
                <ShieldCheck size={14} />
                <div><strong>{event.action}</strong><small>{event.entity_type} · {event.created_at}</small></div>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div><p>04 / JOBS</p><h2>Trabajo asíncrono</h2></div>
            <span>{canManage ? "Owner/Admin" : "Restringido"}</span>
          </header>
          <div className={styles.list}>
            {(jobs ?? []).map((job) => (
              <div className={styles.listItem} key={job.id}>
                <FileClock size={14} />
                <div><strong>{job.job_type}</strong><small>Intentos {job.attempt_count}{job.last_error ? ` · ${job.last_error}` : ""}</small></div>
                <span className={styles.chip}>{job.status}</span>
              </div>
            ))}
            {!jobs?.length && (
              <div className={styles.empty}>
                {canManage ? "No hay jobs visibles." : "Solo Owner y Admin ven la cola."}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
