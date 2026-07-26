import type { Metadata } from "next";

import { PublicHeader } from "@/components/marketing/public-header";

import { DemoExperience } from "./demo-experience";
import styles from "./demo.module.css";

export const metadata: Metadata = {
  title: "Demo guiada",
  description:
    "Recorre el flujo de TicketRoute desde una solicitud natural hasta un plan confirmado.",
};

export default function DemoPage() {
  return (
    <main className={styles.demoPage}>
      <PublicHeader />

      <section className={styles.demoIntro}>
        <div>
          <p>
            <span aria-hidden="true" />
            Demo aislada · sin registro
          </p>
          <h1>Una solicitud. Tres rutas. Una decisión explicable.</h1>
        </div>
        <span>
          Este recorrido utiliza datos locales de demostración. No envía
          información a proveedores externos ni modifica el Command Center.
        </span>
      </section>

      <DemoExperience />
    </main>
  );
}
