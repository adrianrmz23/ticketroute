"use client";

import styles from "./system-feedback.module.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-MX">
      <body>
        <main className={styles.page}>
          <section className={styles.panel} aria-labelledby="global-error-title">
            <p className={styles.eyebrow}>TICKETROUTE / RECUPERACIÓN</p>
            <h1 id="global-error-title">La interfaz necesita reiniciarse.</h1>
            <p>
              Tus registros continúan protegidos en PostgreSQL. Reinicia la
              interfaz para recuperar la sesión visual.
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={reset}>
                Reiniciar interfaz
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
