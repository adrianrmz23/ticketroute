import { Bell, Radio, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { NotificationStream } from "@/features/system/components/notification-stream";
import { PreferencesForm } from "@/features/system/components/preferences-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/app/notifications");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding");

  const [{ data: notifications, error }, { data: preference }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("notification_preferences")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (error) {
    throw new Error(
      "No se pudieron cargar las notificaciones. Ejecuta la migración 0012.",
    );
  }
  const unread = (notifications ?? []).filter((item) => !item.read_at).length;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SISTEMA / SEÑALES</p>
          <h1>Atención proporcional al evento.</h1>
          <p className={styles.heroText}>
            TicketRoute notifica bloqueos y decisiones declaradas. No
            convierte presencia, conexión ni velocidad individual en alertas.
          </p>
        </div>
        <div className={styles.stamp}>
          <Bell size={20} />
          <span><strong>{String(unread).padStart(2, "0")}</strong>Sin leer</span>
        </div>
      </header>
      <div className={styles.split}>
        <NotificationStream
          workspaceId={currentWorkspace.id}
          userId={user.id}
          notifications={(notifications ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            href: item.href,
            kind: item.kind,
            readAt: item.read_at,
            createdAt: item.created_at,
          }))}
        />
        <aside className={styles.darkCard}>
          <p className={styles.sectionLabel}>FRONTERA</p>
          <h2>Eventos, no vigilancia</h2>
          <div className={styles.darkList}>
            <div><Radio size={15} /><span><strong>Realtime acotado</strong><small>La suscripción se limita al usuario autenticado mediante RLS.</small></span></div>
            <div><ShieldCheck size={15} /><span><strong>Preferencias por persona</strong><small>Cada integrante decide canales y resumen.</small></span></div>
          </div>
        </aside>
      </div>
      <PreferencesForm
        workspaceId={currentWorkspace.id}
        emailAvailable={Boolean(
          process.env.NOTIFICATION_EMAIL_WEBHOOK_URL,
        )}
        preference={{
          inApp: preference?.in_app ?? true,
          email: preference?.email ?? false,
          blockedSteps: preference?.blocked_steps ?? true,
          assignments: preference?.assignments ?? true,
          invitations: preference?.invitations ?? true,
          councilResults: preference?.council_results ?? true,
          digestFrequency: preference?.digest_frequency ?? "daily",
        }}
      />
    </div>
  );
}
