import Link from "next/link";

import styles from "./system-feedback.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="not-found-title">
        <p className={styles.eyebrow}>404 / RUTA NO ENCONTRADA</p>
        <h1 id="not-found-title">Este recorrido no existe.</h1>
        <p>
          El enlace pudo cambiar o el recurso ya no está disponible dentro de
          tu workspace.
        </p>
        <div className={styles.actions}>
          <Link href="/app">Volver al Command Center</Link>
        </div>
      </section>
    </main>
  );
}
