"use client";

import Link from "next/link";
import { useEffect } from "react";

import styles from "../system-feedback.module.css";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TicketRoute workspace error", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="workspace-error-title">
        <p className={styles.eyebrow}>WORKSPACE / RECUPERACIÓN</p>
        <h1 id="workspace-error-title">Este módulo necesita otra revisión.</h1>
        <p>
          No se modificó ningún dato de forma silenciosa. Reintenta o vuelve a
          una superficie estable.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={reset}>
            Reintentar módulo
          </button>
          <Link href="/app">Ir al Command Center</Link>
        </div>
      </section>
    </main>
  );
}
