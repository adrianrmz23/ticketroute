export default function ExecutionBoardLoading() {
  return (
    <div
      aria-label="Cargando recorrido"
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        color: "var(--tr-ink-muted)",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 10,
      }}
    >
      PREPARANDO RECORRIDO VERIFICABLE…
    </div>
  );
}
