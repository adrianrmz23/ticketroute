"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Gauge,
  History,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import {
  estimateConfidenceLabels,
  estimateConfidences,
  estimateFactorDirectionLabels,
  estimationUnitLabels,
  type EstimateProposal,
} from "@/domain/planning/estimate";
import { saveEstimateAction } from "@/features/planning/actions";

import styles from "./planning-lab.module.css";

type PlanningLabProps = {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  initialProposal: EstimateProposal;
  confirmedVersion: number | null;
  confirmedAt: string | null;
};

const scenarioOrder = ["favorable", "probable", "adverse"] as const;

const directionIcons = {
  increases: ArrowUpRight,
  decreases: ArrowDownRight,
  neutral: ArrowRight,
};

function replaceScenarioRange(
  proposal: EstimateProposal,
  key: (typeof scenarioOrder)[number],
  field: "low" | "high",
  value: number,
) {
  return {
    ...proposal,
    scenarios: {
      ...proposal.scenarios,
      [key]: {
        ...proposal.scenarios[key],
        [field]: value,
      },
    },
  };
}

export function PlanningLab({
  ticketId,
  ticketTitle,
  ticketStatus,
  initialProposal,
  confirmedVersion,
  confirmedAt,
}: PlanningLabProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    confirmedVersion
      ? `Versión ${String(confirmedVersion).padStart(2, "0")} confirmada`
      : "Propuesta local lista para revisión",
  );
  const [dirty, setDirty] = useState(false);

  async function save() {
    setPending(true);
    setMessage("Confirmando rangos…");
    const result = await saveEstimateAction({ ticketId, proposal });
    setPending(false);
    setMessage(result.message);
    if (result.status === "success") {
      setDirty(false);
      router.refresh();
    }
  }

  function reset() {
    setProposal(initialProposal);
    setDirty(false);
    setMessage("Propuesta restaurada");
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p><span aria-hidden="true" /> PLANNING LAB / RANGOS</p>
          <h1>Estimar sin fingir certeza.</h1>
          <span>
            {ticketTitle} · Estado actual: {ticketStatus}. Ajusta el criterio
            manual antes de confirmar una nueva versión.
          </span>
        </div>
        <div className={styles.traceStamp}>
          <Scale size={19} />
          <span>
            <strong>
              {confirmedVersion
                ? String(confirmedVersion).padStart(2, "0")
                : "LOCAL"}
            </strong>
            {confirmedVersion ? "Versión vigente" : "Sin confirmar"}
          </span>
        </div>
      </header>

      <section className={styles.scenarioSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>01 / ESCENARIOS</span>
            <h2>Tres futuros posibles</h2>
          </div>
          <div className={styles.confidenceControl}>
            <label htmlFor="estimate-confidence">Confianza</label>
            <select
              id="estimate-confidence"
              value={proposal.confidence}
              onChange={(event) => {
                setProposal((current) => ({
                  ...current,
                  confidence: event.target
                    .value as EstimateProposal["confidence"],
                }));
                setDirty(true);
              }}
            >
              {estimateConfidences.map((confidence) => (
                <option value={confidence} key={confidence}>
                  {estimateConfidenceLabels[confidence]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.scenarioGrid}>
          {scenarioOrder.map((key, index) => {
            const scenario = proposal.scenarios[key];
            return (
              <article data-scenario={key} key={key}>
                <header>
                  <span>0{index + 1}</span>
                  <strong>{scenario.label}</strong>
                </header>
                <div className={styles.rangeInputs}>
                  <label>
                    <span>Desde</span>
                    <input
                      aria-label={`${scenario.label} desde`}
                      min={1}
                      step={1}
                      type="number"
                      value={scenario.low}
                      onChange={(event) => {
                        setProposal((current) =>
                          replaceScenarioRange(
                            current,
                            key,
                            "low",
                            Number(event.target.value),
                          ),
                        );
                        setDirty(true);
                      }}
                    />
                  </label>
                  <span>–</span>
                  <label>
                    <span>Hasta</span>
                    <input
                      aria-label={`${scenario.label} hasta`}
                      min={1}
                      step={1}
                      type="number"
                      value={scenario.high}
                      onChange={(event) => {
                        setProposal((current) =>
                          replaceScenarioRange(
                            current,
                            key,
                            "high",
                            Number(event.target.value),
                          ),
                        );
                        setDirty(true);
                      }}
                    />
                  </label>
                  <b>{estimationUnitLabels[proposal.unit]}</b>
                </div>
                <p>{scenario.explanation}</p>
              </article>
            );
          })}
        </div>

        <div className={styles.rangeRule}>
          <ShieldCheck size={16} />
          <span>
            <strong>Ningún escenario admite una cifra exacta.</strong>
            Cada valor conserva límites inferior y superior verificables.
          </span>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.basisPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>02 / BASE</span>
              <h2>Criterio de estimación</h2>
            </div>
            <Gauge size={18} />
          </div>
          <textarea
            aria-label="Base de la estimación"
            value={proposal.basis}
            onChange={(event) => {
              setProposal((current) => ({
                ...current,
                basis: event.target.value,
              }));
              setDirty(true);
            }}
          />
          <dl className={styles.snapshot}>
            <div>
              <dt>Complejidad</dt>
              <dd>{proposal.calculationSnapshot.complexityScore}</dd>
            </div>
            <div>
              <dt>Capacidad</dt>
              <dd>{proposal.calculationSnapshot.capacityHoursPerWeek}h</dd>
            </div>
            <div>
              <dt>Comparables</dt>
              <dd>{proposal.calculationSnapshot.comparableCount}</dd>
            </div>
          </dl>

          <div className={styles.breakdown}>
            <h3>Descomposición del trabajo</h3>
            {proposal.decomposition.map((item) => (
              <div key={item.label}>
                <span style={{ "--share": `${item.effortShare}%` } as CSSProperties}>
                  <i />
                </span>
                <p>
                  <strong>{item.label}</strong>
                  <small>{item.basis}</small>
                </p>
                <b>{item.effortShare}%</b>
              </div>
            ))}
          </div>
        </section>

        <aside className={styles.factorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>03 / FACTORES</span>
              <h2>Qué mueve el rango</h2>
            </div>
          </div>
          <ul>
            {proposal.factors.map((factor) => {
              const Icon = directionIcons[factor.direction];
              return (
                <li data-direction={factor.direction} key={factor.key}>
                  <span><Icon size={13} /></span>
                  <p>
                    <strong>{factor.label}</strong>
                    <small>{factor.evidence}</small>
                  </p>
                  <em>
                    {estimateFactorDirectionLabels[factor.direction]} ·{" "}
                    {factor.weight}
                  </em>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <section className={styles.evidencePanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>04 / EVIDENCIA</span>
            <h2>Supuestos, incertidumbre y referencias</h2>
          </div>
          <History size={18} />
        </div>
        <div className={styles.evidenceGrid}>
          {[
            ["Supuestos", proposal.assumptions],
            ["Incógnitas", proposal.unknowns],
            ["Riesgos", proposal.risks],
            ["Dependencias", proposal.dependencies],
            ["Historia", proposal.historicalReferences],
          ].map(([label, items]) => (
            <article key={label as string}>
              <h3>{label as string}</h3>
              {(items as string[]).length ? (
                <ul>
                  {(items as string[]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>Sin señales declaradas.</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.actions}>
        <div>
          <span data-dirty={dirty}>{message}</span>
          {confirmedAt && (
            <small>
              Última confirmación: {confirmedAt.replace("T", " ").slice(0, 16)} UTC
            </small>
          )}
        </div>
        <div>
          <Link href={`/app/tickets/${ticketId}`}>Volver al ticket</Link>
          <button type="button" className={styles.resetButton} onClick={reset}>
            <RotateCcw size={14} /> Restablecer
          </button>
          {confirmedVersion && (
            <Link href={`/app/planning/${ticketId}/assignment`}>
              Comparar asignaciones <ArrowRight size={14} />
            </Link>
          )}
          <button type="button" disabled={pending} onClick={() => void save()}>
            {pending ? (
              "Confirmando…"
            ) : (
              <><Save size={15} /> Confirmar estimación</>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
