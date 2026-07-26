"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ClipboardCheck,
  GitBranch,
  Plus,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  guidePhaseLabels,
  guidePhases,
  guideSourceLabels,
  type GuideCandidate,
  type PlanningGuide,
  type PlanningGuideStep,
} from "@/domain/guides/planning-guide";
import { estimationUnitLabels } from "@/domain/planning/estimate";
import { confirmPlanningGuideAction } from "@/features/guides/actions";

import styles from "./planning-guide-editor.module.css";

type PlanningGuideEditorProps = {
  ticketId: string;
  ticketTitle: string;
  assignmentVersion: number;
  candidates: GuideCandidate[];
  initialGuide: PlanningGuide;
  generatedGuide: PlanningGuide;
  confirmedVersion: number | null;
  confirmedGuideId: string | null;
  confirmedAt: string | null;
  sourcesChanged: boolean;
};

function cloneGuide(guide: PlanningGuide): PlanningGuide {
  return JSON.parse(JSON.stringify(guide)) as PlanningGuide;
}

function splitSignals(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeSteps(steps: PlanningGuideStep[]) {
  return steps.map((step, position) => ({ ...step, position }));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-MX");
}

export function PlanningGuideEditor({
  ticketId,
  ticketTitle,
  assignmentVersion,
  candidates,
  initialGuide,
  generatedGuide,
  confirmedVersion,
  confirmedGuideId,
  confirmedAt,
  sourcesChanged,
}: PlanningGuideEditorProps) {
  const router = useRouter();
  const [guide, setGuide] = useState(() => cloneGuide(initialGuide));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    sourcesChanged
      ? "Las fuentes cambiaron; revisa esta nueva propuesta"
      : confirmedVersion
        ? `Guía ${String(confirmedVersion).padStart(2, "0")} vigente`
        : "Propuesta local lista para revisar",
  );

  const candidateById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.userId, candidate])),
    [candidates],
  );
  const totalEffort = guide.steps.reduce(
    (total, step) => total + step.effortShare,
    0,
  );
  const ownersValid = guide.steps.every((step) =>
    candidateById.has(step.responsibleUserId),
  );
  const contentValid =
    guide.objective.trim().length >= 8 &&
    guide.sequenceRationale.trim().length >= 12 &&
    guide.verificationStrategy.trim().length >= 8 &&
    guide.steps.every(
      (step) =>
        step.title.trim().length >= 3 &&
        step.outcome.trim().length >= 5 &&
        step.verification.trim().length >= 5 &&
        step.sourceLabel.trim().length >= 1,
    );
  const guideValid =
    guide.steps.length >= 3 &&
    guide.steps.length <= 30 &&
    totalEffort === 100 &&
    ownersValid &&
    contentValid;
  const canConfirm =
    guideValid && (!confirmedVersion || dirty || sourcesChanged) && !pending;

  function updateGuide(update: (current: PlanningGuide) => PlanningGuide) {
    setGuide(update);
    setDirty(true);
    setMessage("Cambios locales pendientes de confirmar");
  }

  function updateStep(
    localId: string,
    update: (step: PlanningGuideStep) => PlanningGuideStep,
  ) {
    updateGuide((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.localId === localId ? update(step) : step,
      ),
    }));
  }

  function moveStep(localId: string, direction: -1 | 1) {
    updateGuide((current) => {
      const index = current.steps.findIndex((step) => step.localId === localId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.steps.length) {
        return current;
      }
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps: normalizeSteps(steps) };
    });
  }

  function addStep() {
    updateGuide((current) => {
      if (current.steps.length >= 30) return current;
      const largestIndex = current.steps.reduce(
        (best, step, index, steps) =>
          step.effortShare > steps[best].effortShare ? index : best,
        0,
      );
      const contribution = Math.min(
        5,
        Math.max(1, current.steps[largestIndex].effortShare - 1),
      );
      const nextSteps = current.steps.map((step, index) =>
        index === largestIndex
          ? { ...step, effortShare: step.effortShare - contribution }
          : step,
      );
      const responsible = candidates[0];
      nextSteps.push({
        localId: `manual-${Date.now()}`,
        position: nextSteps.length,
        phase: "build",
        title: "Nuevo paso verificable",
        outcome: "Describe el resultado observable de este paso.",
        responsibleUserId: responsible.userId,
        responsibleName: responsible.displayName,
        effortShare: contribution,
        verification: "Describe cómo se comprobará el resultado.",
        dependencies: [],
        risks: [],
        sourceKind: "manual",
        sourceLabel: "Criterio agregado por el usuario",
      });
      return { ...current, steps: normalizeSteps(nextSteps) };
    });
  }

  function removeStep(localId: string) {
    updateGuide((current) => {
      if (current.steps.length <= 3) return current;
      const removed = current.steps.find((step) => step.localId === localId);
      const remaining = current.steps.filter((step) => step.localId !== localId);
      if (!removed || !remaining.length) return current;
      const largestIndex = remaining.reduce(
        (best, step, index, steps) =>
          step.effortShare > steps[best].effortShare ? index : best,
        0,
      );
      remaining[largestIndex] = {
        ...remaining[largestIndex],
        effortShare:
          remaining[largestIndex].effortShare + removed.effortShare,
      };
      return { ...current, steps: normalizeSteps(remaining) };
    });
  }

  function restore() {
    setGuide(cloneGuide(generatedGuide));
    setDirty(true);
    setMessage("Propuesta local restablecida desde sus fuentes vigentes");
  }

  async function confirm() {
    const normalizedGuide: PlanningGuide = {
      ...guide,
      steps: normalizeSteps(guide.steps).map((step) => ({
        ...step,
        responsibleName:
          candidateById.get(step.responsibleUserId)?.displayName ??
          step.responsibleName,
      })),
    };
    setPending(true);
    setMessage("Confirmando recorrido…");
    const result = await confirmPlanningGuideAction({
      ticketId,
      guide: normalizedGuide,
    });
    setPending(false);
    setMessage(result.message);
    if (result.status === "success") {
      setDirty(false);
      router.refresh();
    }
  }

  const contractChecks = [
    {
      label: "Distribución completa",
      detail: `${totalEffort}% de 100%`,
      valid: totalEffort === 100,
    },
    {
      label: "Responsables confirmados",
      detail: `${guide.steps.filter((step) => candidateById.has(step.responsibleUserId)).length}/${guide.steps.length} pasos`,
      valid: ownersValid,
    },
    {
      label: "Resultados verificables",
      detail: `${guide.steps.filter((step) => step.verification.trim().length >= 5).length}/${guide.steps.length} comprobaciones`,
      valid: guide.steps.every(
        (step) => step.verification.trim().length >= 5,
      ),
    },
    {
      label: "Fuentes conservadas",
      detail: `${guide.steps.filter((step) => step.sourceLabel.trim()).length}/${guide.steps.length} trazables`,
      valid: guide.steps.every((step) => step.sourceLabel.trim()),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>
            <span aria-hidden="true" /> PLANNING LAB / GUÍA
          </p>
          <h1>Convertir decisiones en un recorrido ejecutable.</h1>
          <span>
            {ticketTitle} · Asignación{" "}
            {String(assignmentVersion).padStart(2, "0")} vigente. Ajusta el
            orden, los responsables y las comprobaciones antes de confirmar.
          </span>
        </div>
        <div className={styles.traceStamp}>
          <GitBranch size={19} />
          <span>
            <strong>
              {confirmedVersion
                ? String(confirmedVersion).padStart(2, "0")
                : "11"}
            </strong>
            {confirmedVersion ? "Guía vigente" : "Recorrido local"}
          </span>
        </div>
      </header>

      {sourcesChanged && (
        <div className={styles.sourceAlert}>
          <AlertTriangle size={16} />
          La estimación o la asignación cambió. Esta propuesta usa únicamente
          las fuentes vigentes y necesita una nueva confirmación.
        </div>
      )}

      <section className={styles.summaryStrip}>
        <div>
          <span>Rango confirmado</span>
          <strong>
            {guide.estimateRange.low}–{guide.estimateRange.high}{" "}
            {estimationUnitLabels[guide.estimateRange.unit]}
          </strong>
        </div>
        <div>
          <span>Pasos visibles</span>
          <strong>{String(guide.steps.length).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Equipo del plan</span>
          <strong>{String(candidates.length).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Esfuerzo distribuido</span>
          <strong data-valid={totalEffort === 100}>{totalEffort}%</strong>
        </div>
      </section>

      <section className={styles.intentPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>01 / CONTRATO</span>
            <h2>Objetivo, secuencia y verificación</h2>
          </div>
          <ClipboardCheck size={19} />
        </div>
        <div className={styles.intentGrid}>
          <label>
            <span>Objetivo operativo</span>
            <textarea
              value={guide.objective}
              onChange={(event) =>
                updateGuide((current) => ({
                  ...current,
                  objective: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Razón de la secuencia</span>
            <textarea
              value={guide.sequenceRationale}
              onChange={(event) =>
                updateGuide((current) => ({
                  ...current,
                  sequenceRationale: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Estrategia de verificación</span>
            <textarea
              value={guide.verificationStrategy}
              onChange={(event) =>
                updateGuide((current) => ({
                  ...current,
                  verificationStrategy: event.target.value,
                }))
              }
            />
          </label>
        </div>
      </section>

      <div className={styles.workspaceGrid}>
        <section className={styles.roadmap}>
          <div className={styles.sectionHeading}>
            <div>
              <span>02 / RECORRIDO</span>
              <h2>Pasos ordenados y editables</h2>
            </div>
            <button
              type="button"
              className={styles.addButton}
              disabled={guide.steps.length >= 30}
              onClick={addStep}
            >
              <Plus size={14} /> Agregar paso
            </button>
          </div>

          <div className={styles.stepList}>
            {guide.steps.map((step, index) => {
              const candidate = candidateById.get(step.responsibleUserId);
              return (
                <article className={styles.stepCard} key={step.localId}>
                  <div className={styles.stepRail}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {index < guide.steps.length - 1 && <i aria-hidden="true" />}
                  </div>
                  <div className={styles.stepBody}>
                    <header>
                      <div>
                        <span>{guidePhaseLabels[step.phase]}</span>
                        <small>
                          {guideSourceLabels[step.sourceKind]} ·{" "}
                          {step.sourceLabel}
                        </small>
                      </div>
                      <div className={styles.stepActions}>
                        <button
                          type="button"
                          aria-label={`Subir ${step.title}`}
                          disabled={index === 0}
                          onClick={() => moveStep(step.localId, -1)}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${step.title}`}
                          disabled={index === guide.steps.length - 1}
                          onClick={() => moveStep(step.localId, 1)}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar ${step.title}`}
                          disabled={guide.steps.length <= 3}
                          onClick={() => removeStep(step.localId)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </header>

                    <div className={styles.primaryFields}>
                      <label className={styles.titleField}>
                        <span>Título</span>
                        <input
                          aria-label={`Título del paso ${index + 1}`}
                          value={step.title}
                          onChange={(event) =>
                            updateStep(step.localId, (current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Fase</span>
                        <select
                          aria-label={`Fase del paso ${index + 1}`}
                          value={step.phase}
                          onChange={(event) =>
                            updateStep(step.localId, (current) => ({
                              ...current,
                              phase: event.target
                                .value as PlanningGuideStep["phase"],
                            }))
                          }
                        >
                          {guidePhases.map((phase) => (
                            <option value={phase} key={phase}>
                              {guidePhaseLabels[phase]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Esfuerzo</span>
                        <span className={styles.percentField}>
                          <input
                            aria-label={`Esfuerzo del paso ${index + 1}`}
                            type="number"
                            min={1}
                            max={100}
                            value={step.effortShare}
                            onChange={(event) =>
                              updateStep(step.localId, (current) => ({
                                ...current,
                                effortShare: Math.max(
                                  1,
                                  Math.min(100, Number(event.target.value)),
                                ),
                              }))
                            }
                          />
                          %
                        </span>
                      </label>
                    </div>

                    <div className={styles.responsibleField}>
                      <span className={styles.avatar}>
                        {initials(candidate?.displayName ?? "Integrante")}
                      </span>
                      <label>
                        <span>Responsable del resultado</span>
                        <select
                          aria-label={`Responsable del paso ${index + 1}`}
                          value={step.responsibleUserId}
                          onChange={(event) => {
                            const next = candidateById.get(event.target.value);
                            updateStep(step.localId, (current) => ({
                              ...current,
                              responsibleUserId: event.target.value,
                              responsibleName:
                                next?.displayName ?? current.responsibleName,
                            }));
                          }}
                        >
                          {candidates.map((item) => (
                            <option value={item.userId} key={item.userId}>
                              {item.displayName} ·{" "}
                              {item.participationRole === "responsible"
                                ? "Responsable"
                                : "Colaborador"}{" "}
                              · {item.contributionPercent}%
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className={styles.outcomeFields}>
                      <label>
                        <span>Resultado observable</span>
                        <textarea
                          value={step.outcome}
                          onChange={(event) =>
                            updateStep(step.localId, (current) => ({
                              ...current,
                              outcome: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Cómo se comprueba</span>
                        <textarea
                          value={step.verification}
                          onChange={(event) =>
                            updateStep(step.localId, (current) => ({
                              ...current,
                              verification: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <details className={styles.stepDetails}>
                      <summary>Fuente, dependencias y riesgos</summary>
                      <div>
                        <label>
                          <span>Fuente conservada</span>
                          <input
                            value={step.sourceLabel}
                            onChange={(event) =>
                              updateStep(step.localId, (current) => ({
                                ...current,
                                sourceLabel: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Dependencias — una por línea</span>
                          <textarea
                            value={step.dependencies.join("\n")}
                            onChange={(event) =>
                              updateStep(step.localId, (current) => ({
                                ...current,
                                dependencies: splitSignals(event.target.value),
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Riesgos — uno por línea</span>
                          <textarea
                            value={step.risks.join("\n")}
                            onChange={(event) =>
                              updateStep(step.localId, (current) => ({
                                ...current,
                                risks: splitSignals(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={styles.contract}>
          <div className={styles.sectionHeading}>
            <div>
              <span>03 / CONTROL</span>
              <h2>Contrato de ejecución</h2>
            </div>
            <ShieldCheck size={19} />
          </div>
          <ul className={styles.contractChecks}>
            {contractChecks.map((check) => (
              <li data-valid={check.valid} key={check.label}>
                <span>
                  {check.valid ? (
                    <Check size={13} />
                  ) : (
                    <AlertTriangle size={13} />
                  )}
                </span>
                <div>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.peopleBlock}>
            <span>Equipo confirmado</span>
            {candidates.map((candidate) => (
              <div key={candidate.userId}>
                <span className={styles.avatar}>
                  {initials(candidate.displayName)}
                </span>
                <p>
                  <strong>{candidate.displayName}</strong>
                  <small>
                    {candidate.participationRole === "responsible"
                      ? "Responsable"
                      : "Colaborador"}{" "}
                    · {candidate.contributionPercent}%
                  </small>
                </p>
              </div>
            ))}
          </div>

          <div className={styles.limitsBlock}>
            <span>Límites de evidencia</span>
            <ul>
              {guide.evidenceLimitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>

          <div className={styles.privacyRule}>
            <UsersRound size={16} />
            <p>
              <strong>Sin vigilancia individual</strong>
              La guía distribuye trabajo declarado. No observa actividad,
              presencia ni productividad.
            </p>
          </div>
        </aside>
      </div>

      <footer className={styles.actions}>
        <div>
          <span data-dirty={dirty || sourcesChanged}>{message}</span>
          {confirmedAt && !sourcesChanged && (
            <small>
              Última confirmación:{" "}
              {confirmedAt.replace("T", " ").slice(0, 16)} UTC
            </small>
          )}
        </div>
        <div>
          <Link href={`/app/planning/${ticketId}/assignment`}>
            <ArrowLeft size={14} /> Volver a asignación
          </Link>
          <button
            type="button"
            className={styles.resetButton}
            onClick={restore}
          >
            <RotateCcw size={14} /> Restablecer propuesta
          </button>
          {confirmedGuideId && !sourcesChanged && (
            <Link href={`/app/board/${ticketId}`}>
              <Play size={14} /> Abrir Execution Board
            </Link>
          )}
          <button type="button" disabled={!canConfirm} onClick={() => void confirm()}>
            {pending ? (
              "Confirmando…"
            ) : (
              <>
                <Save size={15} /> Confirmar guía
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
