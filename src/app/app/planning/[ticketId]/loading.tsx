export default function PlanningTicketLoading() {
  return (
    <div
      aria-label="Cargando Planning Lab"
      style={{
        minHeight: "55vh",
        display: "grid",
        placeItems: "center",
        color: "var(--tr-ink-muted)",
        fontFamily: "var(--font-geist-mono)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      Calculando escenarios…
    </div>
  );
}

