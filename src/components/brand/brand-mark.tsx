import styles from "./brand-mark.module.css";

type BrandMarkProps = {
  compact?: boolean;
  tone?: "inverse" | "ink";
};

export function BrandMark({
  compact = false,
  tone = "inverse",
}: BrandMarkProps) {
  const className = [
    compact ? styles.compactBrand : styles.brand,
    tone === "ink" ? styles.ink : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={className}
      aria-label="TicketRoute"
    >
      <span className={styles.symbol} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className={styles.wordmark}>
          Ticket<span>Route</span>
        </span>
      )}
    </span>
  );
}
