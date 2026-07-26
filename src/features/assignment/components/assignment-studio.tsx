"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  GitBranch,
  GitCompareArrows,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { calculateAssignmentLoad } from "@/application/assignment/generate-assignment-scenarios";
import {
  assignmentStrategies,
  assignmentStrategyLabels,
  knowledgeConcentrationLabels,
  type AssignmentCandidate,
  type AssignmentParticipant,
  type AssignmentScenario,
  type AssignmentStrategy,
} from "@/domain/assignment/assignment";
import {
  estimateConfidenceLabels,
  estimateConfidences,
  estimationUnitLabels,
} from "@/domain/planning/estimate";
import { confirmAssignmentAction } from "@/features/assignment/actions";
import { workspaceRoleLabels } from "@/domain/workspaces/workspace";

import styles from "./assignment-studio.module.css";

type AssignmentStudioProps = {
  ticketId: string;
  ticketTitle: string;
  estimateVersion: number;
  weeklyCapacityHours: number;
  candidates: AssignmentCandidate[];
  initialScenarios: AssignmentScenario[];
  initialStrategy: AssignmentStrategy;
  rangeEnvelope: { low: number; high: number };
  confirmedVersion: number | null;
  confirmedAt: string | null;
};

function scenariosByStrategy(scenarios: AssignmentScenario[]) {
  return Object.fromEntries(
    scenarios.map((scenario) => [scenario.strategy, scenario]),
  ) as Record<AssignmentStrategy, AssignmentScenario>;
}

function cloneScenario(scenario: AssignmentScenario): AssignmentScenario {
  return JSON.parse(JSON.stringify(scenario)) as AssignmentScenario;
}

function distributeParticipants(
  userIds: string[],
  responsibleId: string,
  candidates: AssignmentCandidate[],
  previous: AssignmentParticipant[],
) {
  const unique = [
    responsibleId,
    ...userIds.filter((userId) => userId !== responsibleId),
  ];
  const base = Math.floor(100 / unique.length);
  const priorById = new Map(
    previous.map((participant) => [participant.userId, participant]),
  );
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.userId, candidate]),
  );

  return unique.map((userId, index) => {
    const prior = priorById.get(userId);
    return {
      userId,
      displayName:
        candidateById.get(userId)?.displayName ??
        prior?.displayName ??
        "Integrante",
      participationRole:
        userId === responsibleId ? "responsible" : "collaborator",
      contributionPercent:
        index === 0 ? 100 - base * (unique.length - 1) : base,
      reason:
        prior?.reason ??
        (userId === responsibleId
          ? "Responsabilidad seleccionada por el usuario."
          : "Colaboración agregada por el usuario."),
    } satisfies AssignmentParticipant;
  });
}

export function AssignmentStudio({
  ticketId,
  ticketTitle,
  estimateVersion,
  weeklyCapacityHours,
  candidates,
  initialScenarios,
  initialStrategy,
  rangeEnvelope,
  confirmedVersion,
  confirmedAt,
}: AssignmentStudioProps) {
  const router = useRouter();
  const initialByStrategy = useMemo(
    () => scenariosByStrategy(initialScenarios),
    [initialScenarios],
  );
  const [scenarios, setScenarios] = useState(() =>
    scenariosByStrategy(initialScenarios),
  );
  const [selectedStrategy, setSelectedStrategy] = useState(initialStrategy);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(
    confirmedVersion
      ? `Plan ${String(confirmedVersion).padStart(2, "0")} confirmado`
      : "Cuatro escenarios locales listos para comparar",
  );
  const selected = scenarios[selectedStrategy];
  const responsible = selected.participants.find(
    (participant) => participant.participationRole === "responsible",
  )!;
  const totalContribution = selected.participants.reduce(
    (total, participant) => total + participant.contributionPercent,
    0,
  );

  function updateSelected(
    updater: (scenario: AssignmentScenario) => AssignmentScenario,
  ) {
    setScenarios((current) => ({
      ...current,
      [selectedStrategy]: updater(current[selectedStrategy]),
    }));
    setDirty(true);
    setMessage("Cambios locales pendientes de confirmar");
  }

  function withRecalculatedLoad(scenario: AssignmentScenario) {
    const nextResponsible = scenario.participants.find(
      (participant) => participant.participationRole === "responsible",
    )!;
    const candidate = candidates.find(
      (item) => item.userId === nextResponsible.userId,
    );

    return {
      ...scenario,
      resultingLoad: calculateAssignmentLoad(
        scenario.range.high,
        scenario.range.unit,
        weeklyCapacityHours,
        nextResponsible.contributionPercent,
        candidate?.activeAssignmentCount ?? 0,
        candidate?.planningProfile?.availabilityHours,
        candidate?.planningProfile?.plannedHours ?? 0,
      ),
    };
  }

  function changeResponsible(userId: string) {
    updateSelected((scenario) => {
      const userIds = scenario.participants.map(
        (participant) => participant.userId,
      );
      const next = {
        ...scenario,
        participants: distributeParticipants(
          userIds.includes(userId) ? userIds : [...userIds, userId],
          userId,
          candidates,
          scenario.participants,
        ),
      };
      return withRecalculatedLoad(next);
    });
  }

  function toggleCollaborator(userId: string, checked: boolean) {
    updateSelected((scenario) => {
      const currentIds = scenario.participants.map(
        (participant) => participant.userId,
      );
      const nextIds = checked
        ? [...currentIds, userId]
        : currentIds.filter((participantId) => participantId !== userId);
      const next = {
        ...scenario,
        participants: distributeParticipants(
          nextIds,
          responsible.userId,
          candidates,
          scenario.participants,
        ),
      };
      return withRecalculatedLoad(next);
    });
  }

  function updateContribution(userId: string, value: number) {
    updateSelected((scenario) =>
      withRecalculatedLoad({
        ...scenario,
        participants: scenario.participants.map((participant) =>
          participant.userId === userId
            ? {
                ...participant,
                contributionPercent: Math.max(1, Math.min(100, value)),
              }
            : participant,
        ),
      }),
    );
  }

  async function confirm() {
    setPending(true);
    setMessage("Confirmando decisión…");
    const result = await confirmAssignmentAction({
      ticketId,
      scenario: selected,
    });
    setPending(false);
    setMessage(result.message);
    if (result.status === "success") {
      setDirty(false);
      router.refresh();
    }
  }

  function restore() {
    setScenarios((current) => ({
      ...current,
      [selectedStrategy]: cloneScenario(initialByStrategy[selectedStrategy]),
    }));
    setDirty(false);
    setMessage("Escenario restaurado");
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p><span aria-hidden="true" /> PLANNING LAB / ASIGNACIÓN</p>
          <h1>Asignar sin cajas negras.</h1>
          <span>
            {ticketTitle} · Estimación {String(estimateVersion).padStart(2, "0")}{" "}
            vigente. Compara consecuencias antes de confirmar.
          </span>
        </div>
        <div className={styles.traceStamp}>
          <GitCompareArrows size={19} />
          <span>
            <strong>
              {confirmedVersion
                ? String(confirmedVersion).padStart(2, "0")
                : "04"}
            </strong>
            {confirmedVersion ? "Plan vigente" : "Escenarios"}
          </span>
        </div>
      </header>

      <section className={styles.comparison}>
        <div className={styles.sectionHeading}>
          <div>
            <span>01 / COMPARAR</span>
            <h2>Cuatro rutas, razones visibles</h2>
          </div>
          <small>Selecciona una para editarla</small>
        </div>
        <div className={styles.strategyGrid}>
          {assignmentStrategies.map((strategy, index) => {
            const scenario = scenarios[strategy];
            const scenarioResponsible = scenario.participants.find(
              (participant) =>
                participant.participationRole === "responsible",
            );
            return (
              <button
                type="button"
                data-selected={selectedStrategy === strategy}
                onClick={() => setSelectedStrategy(strategy)}
                key={strategy}
              >
                <span>0{index + 1}</span>
                <strong>{assignmentStrategyLabels[strategy]}</strong>
                <p>{scenario.summary}</p>
                <dl>
                  <div>
                    <dt>Responsable</dt>
                    <dd>{scenarioResponsible?.displayName}</dd>
                  </div>
                  <div>
                    <dt>Rango</dt>
                    <dd>
                      {scenario.range.low}–{scenario.range.high}{" "}
                      {estimationUnitLabels[scenario.range.unit]}
                    </dd>
                  </div>
                  <div>
                    <dt>Carga</dt>
                    <dd>{scenario.resultingLoad.label}</dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.workspaceGrid}>
        <section className={styles.editor}>
          <div className={styles.sectionHeading}>
            <div>
              <span>02 / CONFIGURAR</span>
              <h2>{selected.label}</h2>
            </div>
            <span className={styles.confidenceBadge}>
              Confianza {estimateConfidenceLabels[selected.confidence]}
            </span>
          </div>

          <div className={styles.peopleControls}>
            <label>
              <span>Responsable sugerido</span>
              <select
                value={responsible.userId}
                onChange={(event) => changeResponsible(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option value={candidate.userId} key={candidate.userId}>
                    {candidate.displayName} · {workspaceRoleLabels[candidate.role]}
                    {candidate.planningProfile?.availabilityHours
                      ? ` · ${candidate.planningProfile.plannedHours}/${candidate.planningProfile.availabilityHours}h`
                      : " · capacidad fallback"}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Colaboradores</legend>
              <div>
                {candidates
                  .filter((candidate) => candidate.userId !== responsible.userId)
                  .map((candidate) => (
                    <label key={candidate.userId}>
                      <input
                        type="checkbox"
                        checked={selected.participants.some(
                          (participant) =>
                            participant.userId === candidate.userId,
                        )}
                        onChange={(event) =>
                          toggleCollaborator(
                            candidate.userId,
                            event.target.checked,
                          )
                        }
                      />
                      <span>{candidate.displayName}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.participantList}>
            <header>
              <span>Participación confirmable</span>
              <b data-valid={totalContribution === 100}>
                Total {totalContribution}%
              </b>
            </header>
            {selected.participants.map((participant) => (
              <article key={participant.userId}>
                <span className={styles.avatar}>
                  {participant.displayName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toLocaleUpperCase("es-MX")}
                </span>
                <div>
                  <strong>{participant.displayName}</strong>
                  <small>
                    {participant.participationRole === "responsible"
                      ? "Responsable"
                      : "Colaborador"}{" "}
                    · {participant.reason}
                  </small>
                </div>
                <label>
                  <span>Aporte</span>
                  <input
                    aria-label={`Contribución de ${participant.displayName}`}
                    type="number"
                    min={1}
                    max={100}
                    value={participant.contributionPercent}
                    onChange={(event) =>
                      updateContribution(
                        participant.userId,
                        Number(event.target.value),
                      )
                    }
                  />
                  <b>%</b>
                </label>
              </article>
            ))}
          </div>

          <div className={styles.rangeAndConfidence}>
            <label>
              <span>Desde</span>
              <input
                aria-label="Rango de asignación desde"
                type="number"
                min={rangeEnvelope.low}
                max={rangeEnvelope.high}
                value={selected.range.low}
                onChange={(event) =>
                  updateSelected((scenario) =>
                    withRecalculatedLoad({
                      ...scenario,
                      range: {
                        ...scenario.range,
                        low: Number(event.target.value),
                      },
                    }),
                  )
                }
              />
            </label>
            <span>—</span>
            <label>
              <span>Hasta</span>
              <input
                aria-label="Rango de asignación hasta"
                type="number"
                min={rangeEnvelope.low}
                max={rangeEnvelope.high}
                value={selected.range.high}
                onChange={(event) =>
                  updateSelected((scenario) =>
                    withRecalculatedLoad({
                      ...scenario,
                      range: {
                        ...scenario.range,
                        high: Number(event.target.value),
                      },
                    }),
                  )
                }
              />
            </label>
            <b>{estimationUnitLabels[selected.range.unit]}</b>
            <label>
              <span>Confianza</span>
              <select
                value={selected.confidence}
                onChange={(event) =>
                  updateSelected((scenario) => ({
                    ...scenario,
                    confidence: event.target
                      .value as AssignmentScenario["confidence"],
                  }))
                }
              >
                {estimateConfidences.map((confidence) => (
                  <option value={confidence} key={confidence}>
                    {estimateConfidenceLabels[confidence]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.rationale}>
            <span>Razón de recomendación</span>
            <textarea
              value={selected.rationale}
              onChange={(event) =>
                updateSelected((scenario) => ({
                  ...scenario,
                  rationale: event.target.value,
                }))
              }
            />
          </label>
        </section>

        <aside className={styles.trace}>
          <div className={styles.sectionHeading}>
            <div>
              <span>03 / CONSECUENCIAS</span>
              <h2>Qué cambia con esta ruta</h2>
            </div>
            <Scale size={19} />
          </div>
          <div className={styles.traceMetrics}>
            <div>
              <span>Carga resultante</span>
              <strong>{selected.resultingLoad.label}</strong>
              <small>{selected.resultingLoad.basis}</small>
            </div>
            <div>
              <span>Conocimiento</span>
              <strong>
                {knowledgeConcentrationLabels[
                  selected.knowledgeConcentration
                ]}
              </strong>
              <small>
                {selected.participants.length} persona(s) conservan contexto.
              </small>
            </div>
          </div>
          <div className={styles.consequence}>
            <Sparkles size={15} />
            <p>
              <strong>Consecuencia del cambio</strong>
              {selected.changeConsequence}
            </p>
          </div>
          <div className={styles.listBlock}>
            <span>Riesgos visibles</span>
            <ul>
              {selected.risks.map((risk) => (
                <li key={risk}>
                  <AlertTriangle size={12} /> {risk}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.listBlock}>
            <span>Alternativas descartadas</span>
            <ul>
              {selected.discardedAlternatives.map((alternative) => (
                <li key={alternative}>
                  <ArrowLeft size={12} /> {alternative}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className={styles.evidence}>
        <div className={styles.sectionHeading}>
          <div>
            <span>04 / FRONTERA</span>
            <h2>Señales utilizadas y límites explícitos</h2>
          </div>
          <ShieldCheck size={19} />
        </div>
        <div className={styles.evidenceGrid}>
          {selected.evidence.map((item) => (
            <article data-status={item.status} key={item.signal}>
              <span>
                {item.status === "used" ? (
                  <Check size={13} />
                ) : item.status === "missing" ? (
                  <AlertTriangle size={13} />
                ) : (
                  <ShieldCheck size={13} />
                )}
              </span>
              <div>
                <strong>{item.signal}</strong>
                <p>{item.detail}</p>
              </div>
              <small>
                {item.status === "used"
                  ? "USADA"
                  : item.status === "missing"
                    ? "FALTANTE"
                    : "EXCLUIDA"}
              </small>
            </article>
          ))}
        </div>
        <div className={styles.privacyRule}>
          <UsersRound size={16} />
          <span>
            Nunca se comparan públicamente personas por rendimiento. La decisión
            usa membresía, capacidad y planes declarados; el criterio humano
            conserva la última palabra.
          </span>
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
          <Link href={`/app/planning/${ticketId}`}>
            <ArrowLeft size={14} /> Volver a rangos
          </Link>
          <button type="button" className={styles.resetButton} onClick={restore}>
            <RotateCcw size={14} /> Restablecer
          </button>
          {confirmedVersion && (
            <Link href={`/app/planning/${ticketId}/guide`}>
              Construir guía <GitBranch size={14} />
            </Link>
          )}
          <button
            type="button"
            disabled={pending || totalContribution !== 100}
            onClick={() => void confirm()}
          >
            {pending ? (
              "Confirmando…"
            ) : (
              <><Save size={15} /> Confirmar asignación</>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
