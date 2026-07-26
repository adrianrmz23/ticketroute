import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";

import styles from "./public-header.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.brandLink} href="/" aria-label="TicketRoute inicio">
        <BrandMark tone="ink" />
      </Link>

      <nav className={styles.navigation} aria-label="Navegación pública">
        <a href="#flujo">Cómo funciona</a>
        <a href="#principios">Principios</a>
        <Link href="/demo">Demo</Link>
      </nav>

      <div className={styles.actions}>
        <Link className={styles.secondaryAction} href="/auth/login">
          Iniciar sesión
        </Link>
        <Link className={styles.primaryAction} href="/auth/register">
          Crear cuenta
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
