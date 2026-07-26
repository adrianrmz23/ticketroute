"use client";

import Link from "next/link";
import { useEffect } from "react";

import styles from "./system-feedback.module.css";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TicketRoute route error", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="route-error-title">
        <p className={styles.eyebrow}>RECUPERACIÓN / RUTA</p>
        <h1 id="route-error-title">No pudimos completar esta vista.</h1>
        <p>
          La sesión y tus datos permanecen intactos. Puedes reintentar la
          operación o volver al centro de mando.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={reset}>
            Reintentar
          </button>
          <Link href="/app">Volver al Command Center</Link>
        </div>
      </section>
    </main>
  );
}
