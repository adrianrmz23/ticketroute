import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CircleDot,
  GitBranch,
  MessageSquareText,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { PublicHeader } from "@/components/marketing/public-header";

import styles from "./landing.module.css";

const workflow = [
  {
    step: "01",
    title: "Captura",
    copy: "Habla o escribe la necesidad como realmente llegó al equipo.",
    icon: MessageSquareText,
  },
  {
    step: "02",
    title: "Organiza",
    copy: "Separa alcance, incógnitas, riesgos y criterios verificables.",
    icon: Braces,
  },
  {
    step: "03",
    title: "Compara",
    copy: "Contrasta rangos y asignaciones sin ocultar los supuestos.",
    icon: GitBranch,
  },
  {
    step: "04",
    title: "Confirma",
    copy: "El equipo conserva la decisión final y una ruta auditable.",
    icon: ShieldCheck,
  },
];

const operatingPrinciples = [
  "Rangos explicables, nunca cifras mágicas",
  "La IA propone; el equipo confirma",
  "Sin señales invasivas de productividad",
  "Entrada manual disponible en todo momento",
];

export default function HomePage() {
  return (
    <main className={styles.landing}>
      <PublicHeader />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            Intelligent work routing
          </p>
          <h1>
            Antes de estimar,
            <span> pon el trabajo en ruta.</span>
          </h1>
          <p className={styles.heroLead}>
            TicketRoute convierte solicitudes desordenadas en trabajo técnico
            claro, estimable, asignable y verificable. Sin formularios eternos
            y sin decisiones silenciosas.
          </p>

          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href="/demo">
              Probar demo guiada
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryCta} href="/auth/register">
              Crear cuenta
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.trustLine}>
            <span>
              <Check size={13} aria-hidden="true" />
              Texto y voz
            </span>
            <span>
              <Check size={13} aria-hidden="true" />
              Decisiones explicables
            </span>
            <span>
              <Check size={13} aria-hidden="true" />
              Confirmación humana
            </span>
          </div>
        </div>

        <div className={styles.routingConsole} aria-label="Vista de TicketRoute">
          <div className={styles.consoleHeader}>
            <span>
              <CircleDot size={12} aria-hidden="true" />
              ROUTING CONSOLE
            </span>
            <small>DEMO / LIVE</small>
          </div>

          <div className={styles.consoleRequest}>
            <span>SOLICITUD RECIBIDA</span>
            <p>
              “Necesitamos agregar inicio de sesión con Google antes del
              viernes.”
            </p>
            <small>Entrada natural · 12 palabras</small>
          </div>

          <div className={styles.routeFlow}>
            <div>
              <span>01</span>
              <p>
                <strong>Contexto detectado</strong>
                Frontend listo
              </p>
              <Check size={14} aria-hidden="true" />
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Incógnita crítica</strong>
                Usuarios existentes
              </p>
              <Sparkles size={14} aria-hidden="true" />
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Rango probable</strong>
                3–5 días
              </p>
              <Route size={14} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.consoleFooter}>
            <span>CONFIANZA</span>
            <div>
              <span />
            </div>
            <strong>MEDIA · 74%</strong>
          </div>
        </div>
      </section>

      <section className={styles.signalStrip} aria-label="Capacidades centrales">
        <div>
          <strong>01</strong>
          <span>Una entrada natural</span>
        </div>
        <div>
          <strong>3×</strong>
          <span>Escenarios comparables</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>Trazabilidad de decisión</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Puntuaciones ocultas</span>
        </div>
      </section>

      <section className={styles.workflowSection} id="flujo">
        <div className={styles.sectionIntro}>
          <p>DE INTENCIÓN A EJECUCIÓN</p>
          <h2>Una ruta clara, sin convertir el trabajo en un interrogatorio.</h2>
          <span>
            TicketRoute pregunta solamente lo que puede cambiar el alcance, el
            riesgo o la estimación.
          </span>
        </div>

        <div className={styles.workflowGrid}>
          {workflow.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.step}>
                <header>
                  <span>{item.step}</span>
                  <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
                </header>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.principlesSection} id="principios">
        <div className={styles.principlesCopy}>
          <p>CONTROL HUMANO POR DISEÑO</p>
          <h2>La IA organiza la evidencia. Tu equipo conserva el criterio.</h2>
          <span>
            Cada propuesta expone qué asumió, por qué la recomienda y qué cambia
            si eliges otra ruta.
          </span>
          <Link href="/demo">
            Ver una decisión explicada
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.principlesList}>
          {operatingPrinciples.map((principle, index) => (
            <div key={principle}>
              <span>0{index + 1}</span>
              <p>{principle}</p>
              {index === 2 ? (
                <UsersRound size={18} aria-hidden="true" />
              ) : (
                <ShieldCheck size={18} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <p>DEMO AISLADA · SIN REGISTRO</p>
          <h2>Prueba el recorrido completo en menos de tres minutos.</h2>
        </div>
        <Link href="/demo">
          Iniciar recorrido
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>TicketRoute / Intelligent work routing</span>
        <span>Diseñado para equipos técnicos que necesitan decidir mejor.</span>
      </footer>
    </main>
  );
}
