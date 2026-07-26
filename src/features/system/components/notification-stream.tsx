"use client";

import { BellRing, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { markNotificationReadAction } from "@/features/system/actions";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

import styles from "@/app/app/operations.module.css";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationStream({
  workspaceId,
  userId,
  notifications,
}: {
  workspaceId: string;
  userId: string;
  notifications: Notification[];
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:${workspaceId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, userId, workspaceId]);

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <div><p>01 / BANDEJA</p><h2>Eventos que requieren contexto</h2></div>
        <span>Actualización en tiempo real</span>
      </header>
      <div className={styles.list}>
        {notifications.map((notification) => (
          <article className={styles.listItem} key={notification.id}>
            <BellRing size={16} />
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
                  Abrir <ExternalLink size={12} />
                </Link>
              )}
              {!notification.readAt && (
                <form action={markNotificationReadAction}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  <button
                    className={styles.secondaryButton}
                    aria-label={`Marcar ${notification.title} como leída`}
                  >
                    <Check size={12} /> Leída
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
        {!notifications.length && (
          <div className={styles.empty}>
            <BellRing size={24} />
            <strong>Todo está en calma</strong>
            <span>Los bloqueos y eventos relevantes aparecerán aquí.</span>
          </div>
        )}
      </div>
    </section>
  );
}
