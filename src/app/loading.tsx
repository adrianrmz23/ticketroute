import styles from "./system-feedback.module.css";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <div>
        <div className={styles.loader} aria-hidden="true" />
        <span className="sr-only">Cargando TicketRoute…</span>
      </div>
    </main>
  );
}
