import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Inbox,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { markNotificationReadAction } from "@/features/system/actions";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/app/inbox");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding");
  const canManage = ["owner", "admin"].includes(currentWorkspace.role);

  const [
    { data: notifications },
    { data: blockedSteps },
    { data: invites },
    { data: privacyRequests },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("execution_steps")
      .select("id,execution_run_id,title_snapshot,blocker_note,updated_at")
      .eq("workspace_id", currentWorkspace.id)
      .eq("status", "blocked")
      .order("updated_at", { ascending: false })
      .limit(30),
    canManage
      ? supabase
          .from("workspace_invites")
          .select("id,email,role,expires_at")
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
    supabase
      .from("privacy_requests")
      .select("id,request_type,status,created_at")
      .eq("workspace_id", currentWorkspace.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const runIds = [...new Set((blockedSteps ?? []).map((step) => step.execution_run_id))];
  const { data: runs } = runIds.length
    ? await supabase
        .from("execution_runs")
        .select("id,ticket_id")
        .in("id", runIds)
    : { data: [] };
  const ticketByRun = new Map(
    (runs ?? []).map((run) => [run.id, run.ticket_id]),
  );
  const total =
    (notifications?.length ?? 0) +
    (blockedSteps?.length ?? 0) +
    (invites?.length ?? 0) +
    (privacyRequests?.length ?? 0);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>OPERACIÓN / INBOX</p>
          <h1>Una bandeja para lo que necesita decisión.</h1>
          <p className={styles.heroText}>
            Reúne eventos no leídos, bloqueos declarados, invitaciones y
            solicitudes de privacidad. No convierte actividad individual en
            urgencia.
          </p>
        </div>
        <div className={styles.stamp}>
          <Inbox size={20} />
          <span>
            <strong>{String(total).padStart(2, "0")}</strong>
            Pendientes
          </span>
        </div>
      </header>

      <section className={styles.darkCard}>
        <p className={styles.sectionLabel}>FRONTERA DE ATENCIÓN</p>
        <h2>Solo señales accionables y explicables.</h2>
        <div className={styles.darkList}>
          <div>
            <ShieldCheck size={15} />
            <span>
              <strong>Origen visible</strong>
              <small>Cada elemento enlaza al registro que lo produjo.</small>
            </span>
          </div>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <p>01 / NOTIFICACIONES</p>
              <h2>Sin leer</h2>
            </div>
            <span>{notifications?.length ?? 0}</span>
          </header>
          <div className={styles.list}>
            {(notifications ?? []).map((notification) => (
              <article className={styles.listItem} key={notification.id}>
                <BellRing size={15} />
                <div>
                  <strong>{notification.title}</strong>
                  <small>{notification.body || notification.kind}</small>
                </div>
                <div>
                  {notification.href && (
                    <Link
                      className={styles.secondaryButton}
                      href={notification.href}
                    >
                      Abrir <ArrowUpRight size={12} />
                    </Link>
                  )}
                  <form action={markNotificationReadAction}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <button className={styles.secondaryButton}>Leída</button>
                  </form>
                </div>
              </article>
            ))}
            {!notifications?.length && (
              <div className={styles.empty}>No hay notificaciones sin leer.</div>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <p>02 / EJECUCIÓN</p>
              <h2>Bloqueos declarados</h2>
            </div>
            <span>{blockedSteps?.length ?? 0}</span>
          </header>
          <div className={styles.list}>
            {(blockedSteps ?? []).map((step) => {
              const ticketId = ticketByRun.get(step.execution_run_id);
              return (
                <Link
                  className={styles.listItem}
                  href={ticketId ? `/app/board/${ticketId}` : "/app/board"}
                  key={step.id}
                >
                  <AlertTriangle size={15} />
                  <div>
                    <strong>{step.title_snapshot}</strong>
                    <small>{step.blocker_note || "Bloqueo sin detalle"}</small>
                  </div>
                  <ArrowUpRight size={13} />
                </Link>
              );
            })}
            {!blockedSteps?.length && (
              <div className={styles.empty}>No hay pasos bloqueados.</div>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <p>03 / ACCESO</p>
              <h2>Invitaciones abiertas</h2>
            </div>
            <span>{invites?.length ?? 0}</span>
          </header>
          <div className={styles.list}>
            {(invites ?? []).map((invite) => (
              <Link className={styles.listItem} href="/app/team" key={invite.id}>
                <UserPlus size={15} />
                <div>
                  <strong>{invite.email}</strong>
                  <small>
                    {invite.role} · vence {invite.expires_at}
                  </small>
                </div>
                <ArrowUpRight size={13} />
              </Link>
            ))}
            {!invites?.length && (
              <div className={styles.empty}>No hay invitaciones abiertas.</div>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <p>04 / GOBIERNO</p>
              <h2>Solicitudes en curso</h2>
            </div>
            <span>{privacyRequests?.length ?? 0}</span>
          </header>
          <div className={styles.list}>
            {(privacyRequests ?? []).map((request) => (
              <Link
                className={styles.listItem}
                href="/app/settings/security"
                key={request.id}
              >
                <ShieldCheck size={15} />
                <div>
                  <strong>{request.request_type}</strong>
                  <small>{request.status} · {request.created_at}</small>
                </div>
                <ArrowUpRight size={13} />
              </Link>
            ))}
            {!privacyRequests?.length && (
              <div className={styles.empty}>No hay solicitudes abiertas.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
