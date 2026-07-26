import {
  Activity,
  ArrowUpRight,
  Check,
  CircleAlert,
  Database,
  KeyRound,
  LockKeyhole,
  Radio,
  ServerCog,
} from "lucide-react";

import { checkSupabaseHealth } from "@/application/system/check-supabase-health";
import { getSupabaseEnvPresence } from "@/infrastructure/supabase/env";

import styles from "./system-status.module.css";

export const dynamic = "force-dynamic";

const statusContent = {
  connected: {
    label: "Conectado",
    title: "Supabase responde correctamente.",
    description:
      "La aplicación alcanzó PostgreSQL mediante la clave pública y encontró el esquema 0013.",
  },
  migration_pending: {
    label: "Migración pendiente",
    title: "La conexión existe; falta actualizar el esquema.",
    description:
      "Ejecuta las migraciones pendientes en el SQL Editor y vuelve a cargar esta página.",
  },
  misconfigured: {
    label: "Configuración incompleta",
    title: "Next.js todavía no puede leer las variables.",
    description:
      "Completa .env.local y reinicia npm run dev para cargar la URL y la Publishable key.",
  },
  unreachable: {
    label: "Sin respuesta",
    title: "Supabase no completó la comprobación.",
    description:
      "Verifica la URL, el estado del proyecto y vuelve a intentar. La interfaz no expone el error ni las claves.",
  },
} as const;

function formatCheckedAt(checkedAt: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(checkedAt));
}

export default async function SystemStatusPage() {
  const [health, env] = await Promise.all([
    checkSupabaseHealth(),
    Promise.resolve(getSupabaseEnvPresence()),
  ]);
  const content = statusContent[health.status];
  const ready = health.status === "connected";

  const checks = [
    {
      label: "Project URL",
      detail: env.url ? "Variable detectada" : "Variable ausente",
      ready: env.url,
      icon: Radio,
    },
    {
      label: "Publishable key",
      detail: env.publishableKey ? "Variable detectada" : "Variable ausente",
      ready: env.publishableKey,
      icon: KeyRound,
    },
    {
      label: "Esquema PostgreSQL",
      detail: ready ? "Esquema 0013 activo" : "Validación pendiente",
      ready,
      icon: Database,
    },
    {
      label: "Aislamiento RLS",
      detail: ready ? "Políticas instaladas" : "Validación pendiente",
      ready,
      icon: LockKeyhole,
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>03 / INFRAESTRUCTURA</p>
          <h1>Estado del sistema</h1>
          <p>
            Diagnóstico seguro de la conexión, el esquema base y las políticas
            multiworkspace de TicketRoute.
          </p>
        </div>
        <span className={`${styles.statusChip} ${styles[health.status]}`}>
          <span aria-hidden="true" />
          {content.label}
        </span>
      </header>

      <section
        className={`${styles.hero} ${ready ? styles.heroReady : ""}`}
        aria-labelledby="connection-title"
      >
        <div className={styles.heroIcon} aria-hidden="true">
          {ready ? <Check size={31} /> : <CircleAlert size={31} />}
        </div>
        <div>
          <span>SUPABASE / HEALTHCHECK</span>
          <h2 id="connection-title">{content.title}</h2>
          <p>{content.description}</p>
        </div>
        <dl>
          <div>
            <dt>Latencia</dt>
            <dd>{health.latencyMs ? `${health.latencyMs} ms` : "—"}</dd>
          </div>
          <div>
            <dt>Revisión UTC</dt>
            <dd>{formatCheckedAt(health.checkedAt)}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.grid}>
        <section className={styles.checksPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>VERIFICACIÓN</span>
              <h2>Ruta de conexión</h2>
            </div>
            <Activity size={19} aria-hidden="true" />
          </div>

          <ul>
            {checks.map((check) => {
              const Icon = check.icon;
              return (
                <li key={check.label}>
                  <span className={styles.checkIcon}>
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                  </span>
                  <span
                    className={
                      check.ready ? styles.checkReady : styles.checkPending
                    }
                  >
                    {check.ready ? "LISTO" : "PENDIENTE"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className={styles.securityPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>FRONTERA DE SEGURIDAD</span>
              <h2>Cliente público</h2>
            </div>
            <ServerCog size={19} aria-hidden="true" />
          </div>

          <p>
            El navegador recibe únicamente la URL y la Publishable key. El
            acceso real a cada fila lo decide PostgreSQL mediante RLS.
          </p>

          <div className={styles.securityRule}>
            <LockKeyhole size={18} aria-hidden="true" />
            <div>
              <strong>Service Role no admitida</strong>
              <small>
                Nunca la agregues a variables con prefijo NEXT_PUBLIC_.
              </small>
            </div>
          </div>

          <a href="/api/health/supabase" target="_blank" rel="noreferrer">
            Abrir respuesta JSON
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </aside>
      </div>

      <section className={styles.nextStep}>
        <span>CIERRE OPERATIVO</span>
        <h2>Superficie integral verificada</h2>
        <p>
          Calibración, Consejo, ejecución avanzada, notificaciones,
          integraciones, privacidad y trabajos asíncronos comparten el mismo
          aislamiento multiworkspace.
        </p>
      </section>
    </div>
  );
}
