import { ArrowLeft, Check, LockKeyhole, Route } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";

import styles from "./auth.module.css";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const trustItems = [
  "Sesión validada en servidor",
  "Cookies renovadas por Proxy",
  "Datos aislados mediante RLS",
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className={styles.authPage}>
      <section className={styles.missionPanel} aria-label="Acceso TicketRoute">
        <div className={styles.missionTop}>
          <Link href="/" aria-label="Volver al inicio de TicketRoute">
            <BrandMark />
          </Link>
          <span>
            <span aria-hidden="true" />
            SECURITY GATE / 04
          </span>
        </div>

        <div className={styles.missionCopy}>
          <div className={styles.routeIcon} aria-hidden="true">
            <Route size={27} strokeWidth={1.5} />
          </div>
          <p>CONTROL DE ACCESO</p>
          <h2>El trabajo privado comienza con una identidad verificable.</h2>
          <p>
            TicketRoute conserva la sesión entre navegador y servidor sin
            convertir la seguridad en fricción visible.
          </p>
        </div>

        <div className={styles.trustRail}>
          {trustItems.map((item, index) => (
            <div key={item}>
              <span>
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <p>
                <small>0{index + 1}</small>
                <strong>{item}</strong>
              </p>
            </div>
          ))}
        </div>

        <footer className={styles.missionFooter}>
          <LockKeyhole size={15} aria-hidden="true" />
          <span>
            <strong>Frontera segura</strong>
            <small>La autorización final vive en PostgreSQL.</small>
          </span>
        </footer>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formPanelInner}>
          <Link className={styles.backLink} href="/">
            <ArrowLeft size={14} aria-hidden="true" />
            Volver al inicio
          </Link>

          <header className={styles.formHeader}>
            <p>{eyebrow}</p>
            <h1>{title}</h1>
            <span>{description}</span>
          </header>

          {children}
          {footer && <footer className={styles.formFooter}>{footer}</footer>}
        </div>
      </section>
    </main>
  );
}
