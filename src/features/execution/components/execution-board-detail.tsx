"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleDashed,
  FileCheck2,
  LockKeyhole,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { calculateExecutionProgress } from "@/application/execution/calculate-execution-progress";
import {
  executionRunStatusLabels,
  executionStepStatusLabels,
  type ExecutionRun,
  type ExecutionStepStatus,
} from "@/domain/execution/execution";
import { guidePhaseLabels } from "@/domain/guides/planning-guide";
import {
  startExecutionAction,
  updateExecutionStepAction,
} from "@/features/execution/actions";
import { recordMicrophoneConsentAction } from "@/features/capture/actions";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

import styles from "./execution-board-detail.module.css";

type ExecutionBoardDetailProps = {
  workspaceId: string;
  ticketId: string;
  ticketTitle: string;
  guideId: string;
  guideVersion: number;
  guideObjective: string;
  rangeLabel: string;
  guideStepCount: number;
  guideTeamCount: number;
  run: ExecutionRun | null;
  canManageAll: boolean;
  currentUserId: string;
  capacityWarnings: string[];
};

type Draft = { evidence: string; blocker: string };

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-MX");
}

export function ExecutionBoardDetail({
  workspaceId,
  ticketId,
  ticketTitle,
  guideId,
  guideVersion,
  guideObjective,
  rangeLabel,
  guideStepCount,
  guideTeamCount,
  run,
  canManageAll,
  currentUserId,
  capacityWarnings,
}: ExecutionBoardDetailProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState(
    run
      ? executionRunStatusLabels[run.status]
      : "Guía confirmada lista para iniciar",
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listeningKey, setListeningKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      (run?.steps ?? []).map((step) => [
        step.id,
        {
          evidence: step.evidenceNote,
          blocker: step.blockerNote,
        },
      ]),
    ),
  );
  const progress = useMemo(
    () =>
      run
        ? calculateExecutionProgress(
            run.steps.map((step) => ({
              effortShare: step.effortShare,
              status: step.status,
            })),
          )
        : null,
    [run],
  );

  useEffect(() => {
    if (!run) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`execution:${run.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "execution_steps",
          filter: `execution_run_id=eq.${run.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      recognitionRef.current?.stop();
      void supabase.removeChannel(channel);
    };
  }, [router, run]);

  function updateDraft(
    stepId: string,
    field: keyof Draft,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [stepId]: {
        evidence: current[stepId]?.evidence ?? "",
        blocker: current[stepId]?.blocker ?? "",
        [field]: value,
      },
    }));
  }

  async function start() {
    setPendingId("start");
    setMessage("Preparando snapshot operativo…");
    const result = await startExecutionAction({ ticketId, guideId });
    setPendingId(null);
    setMessage(result.message);
    if (result.status === "success") router.refresh();
  }

  async function transition(stepId: string, status: ExecutionStepStatus) {
    setPendingId(stepId);
    setMessage("Registrando declaración…");
    const draft = drafts[stepId] ?? { evidence: "", blocker: "" };
    const result = await updateExecutionStepAction({
      ticketId,
      executionStepId: stepId,
      status,
      evidenceNote: draft.evidence,
      blockerNote: draft.blocker,
    });
    setPendingId(null);
    setMessage(result.message);
    if (result.status === "success") router.refresh();
  }

  async function dictate(stepId: string, field: keyof Draft) {
    const activeKey = `${stepId}:${field}`;
    if (listeningKey === activeKey) {
      recognitionRef.current?.stop();
      setListeningKey(null);
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Este navegador no ofrece dictado; la entrada manual sigue disponible.");
      return;
    }
    const accepted = window.confirm(
      "TicketRoute usará el micrófono solo para transcribir esta declaración. El audio no se guarda. ¿Continuar?",
    );
    if (!accepted) {
      void recordMicrophoneConsentAction({
        workspaceId,
        captureId: null,
        decision: "denied",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const consent = await recordMicrophoneConsentAction({
        workspaceId,
        captureId: null,
        decision: "granted",
      });
      if (consent.status === "error") throw new Error(consent.message);
      const recognition = new Recognition();
      recognition.lang = "es-MX";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        let transcript = "";
        for (let index = 0; index < event.results.length; index += 1) {
          if (event.results[index].isFinal) {
            transcript += event.results[index][0].transcript;
          }
        }
        if (transcript.trim()) {
          const current = drafts[stepId]?.[field] ?? "";
          updateDraft(
            stepId,
            field,
            `${current}${current.trim() ? " " : ""}${transcript.trim()}`,
          );
        }
      };
      recognition.onend = () => setListeningKey(null);
      recognition.onerror = () => {
        setListeningKey(null);
        setMessage("El navegador interrumpió el dictado. Puedes seguir escribiendo.");
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListeningKey(activeKey);
      setMessage("Escuchando una declaración; el audio no se almacena.");
    } catch {
      setListeningKey(null);
      setMessage("No se habilitó el micrófono. Puedes continuar escribiendo.");
    }
  }

  if (!run) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p><span aria-hidden="true" /> EXECUTION BOARD / ACTIVACIÓN</p>
            <h1>La guía está lista para convertirse en trabajo visible.</h1>
            <span>{ticketTitle}</span>
          </div>
          <div className={styles.traceStamp}>
            <FileCheck2 size={19} />
            <span>
              <strong>{String(guideVersion).padStart(2, "0")}</strong>
              Guía confirmada
            </span>
          </div>
        </header>

        <section className={styles.activation}>
          <div className={styles.activationMain}>
            <span>01 / SNAPSHOT</span>
            <h2>Iniciar sin alterar la decisión original.</h2>
            <p>{guideObjective}</p>
            <div className={styles.activationMetrics}>
              <div><span>Rango</span><strong>{rangeLabel}</strong></div>
              <div><span>Pasos</span><strong>{guideStepCount}</strong></div>
              <div><span>Equipo</span><strong>{guideTeamCount}</strong></div>
            </div>
          </div>
          <aside>
            <ShieldCheck size={24} />
            <h3>Frontera de ejecución</h3>
            <ul>
              <li><Check size={13} /> Copia inmutable de cada paso</li>
              <li><Check size={13} /> Estados declarados por personas</li>
              <li><Check size={13} /> Evidencia y bloqueos visibles</li>
              <li><LockKeyhole size={13} /> Sin actividad individual</li>
            </ul>
          </aside>
        </section>

        <footer className={styles.actions}>
          <span>{message}</span>
          <div>
            <Link href={`/app/planning/${ticketId}/guide`}>
              <ArrowLeft size={14} /> Volver a la guía
            </Link>
            <button
              type="button"
              disabled={pendingId === "start"}
              onClick={() => void start()}
            >
              <Play size={15} />
              {pendingId === "start" ? "Iniciando…" : "Iniciar recorrido"}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p><span aria-hidden="true" /> EXECUTION BOARD / DECLARACIONES</p>
          <h1>Ejecutar con evidencia, no con vigilancia.</h1>
          <span>{ticketTitle}</span>
        </div>
        <div className={styles.traceStamp}>
          <CircleDashed size={19} />
          <span>
            <strong>12</strong>
            {executionRunStatusLabels[run.status]}
          </span>
        </div>
      </header>

      <section className={styles.summaryStrip}>
        <div><span>Progreso verificable</span><strong>{progress?.percentage ?? 0}%</strong></div>
        <div><span>Pasos resueltos</span><strong>{progress?.resolvedCount ?? 0}/{run.steps.length}</strong></div>
        <div><span>En curso</span><strong>{progress?.activeCount ?? 0}</strong></div>
        <div><span>Bloqueos visibles</span><strong>{progress?.blockedCount ?? 0}</strong></div>
      </section>

      <div className={styles.boardGrid}>
        <section className={styles.timeline}>
          <div className={styles.sectionHeading}>
            <div>
              <span>01 / RECORRIDO</span>
              <h2>Estados y comprobaciones</h2>
            </div>
            <small>GUÍA {String(guideVersion).padStart(2, "0")} · {rangeLabel}</small>
          </div>
          <div className={styles.progressTrack}>
            <i style={{ width: `${progress?.percentage ?? 0}%` }} />
          </div>

          <div className={styles.stepList}>
            {run.steps.map((step, index) => {
              const canEdit =
                run.status !== "completed" &&
                (canManageAll || step.responsibleUserId === currentUserId);
              const closed = ["done", "skipped"].includes(step.status);
              const draft = drafts[step.id] ?? {
                evidence: "",
                blocker: "",
              };
              return (
                <article
                  className={styles.stepCard}
                  data-status={step.status}
                  key={step.id}
                >
                  <div className={styles.stepRail}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {index < run.steps.length - 1 && <i />}
                  </div>
                  <div className={styles.stepBody}>
                    <header>
                      <div>
                        <span>{guidePhaseLabels[step.phase]}</span>
                        <h3>{step.title}</h3>
                        <small>{step.sourceLabel}</small>
                      </div>
                      <em data-status={step.status}>
                        {executionStepStatusLabels[step.status]}
                      </em>
                    </header>

                    <div className={styles.stepContract}>
                      <div>
                        <span>Resultado observable</span>
                        <p>{step.outcome}</p>
                      </div>
                      <div>
                        <span>Cómo se comprueba</span>
                        <p>{step.verification}</p>
                      </div>
                    </div>

                    {(step.dependencies.length > 0 ||
                      step.risks.length > 0) && (
                      <div className={styles.boundaries}>
                        <div>
                          <span>Dependencias del snapshot</span>
                          <p>
                            {step.dependencies.length
                              ? step.dependencies.join(" · ")
                              : "Sin dependencias declaradas"}
                          </p>
                        </div>
                        <div>
                          <span>Riesgos del snapshot</span>
                          <p>
                            {step.risks.length
                              ? step.risks.join(" · ")
                              : "Sin riesgos declarados"}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className={styles.ownerRow}>
                      <span className={styles.avatar}>
                        {initials(step.responsibleName)}
                      </span>
                      <div>
                        <span>Responsable declarado</span>
                        <strong>{step.responsibleName}</strong>
                      </div>
                      <b>{step.effortShare}%</b>
                    </div>

                    {!closed && canEdit && (
                      <div className={styles.declarationFields}>
                        <label>
                          <span className={styles.fieldHeading}>
                            Evidencia o razón de omisión
                            <button
                              type="button"
                              onClick={() => void dictate(step.id, "evidence")}
                              aria-label={`Dictar evidencia de ${step.title}`}
                            >
                              <Mic size={12} />
                              {listeningKey === `${step.id}:evidence`
                                ? "Detener"
                                : "Dictar"}
                            </button>
                          </span>
                          <textarea
                            aria-label={`Evidencia de ${step.title}`}
                            value={draft.evidence}
                            onChange={(event) =>
                              updateDraft(
                                step.id,
                                "evidence",
                                event.target.value,
                              )
                            }
                            placeholder="Describe qué resultado puede verificarse…"
                          />
                        </label>
                        <label>
                          <span className={styles.fieldHeading}>
                            Bloqueo visible
                            <button
                              type="button"
                              onClick={() => void dictate(step.id, "blocker")}
                              aria-label={`Dictar bloqueo de ${step.title}`}
                            >
                              <Mic size={12} />
                              {listeningKey === `${step.id}:blocker`
                                ? "Detener"
                                : "Dictar"}
                            </button>
                          </span>
                          <textarea
                            aria-label={`Bloqueo de ${step.title}`}
                            value={draft.blocker}
                            onChange={(event) =>
                              updateDraft(
                                step.id,
                                "blocker",
                                event.target.value,
                              )
                            }
                            placeholder="Describe qué impide continuar…"
                          />
                        </label>
                      </div>
                    )}

                    {closed && (
                      <div className={styles.closedEvidence}>
                        <FileCheck2 size={16} />
                        <p>
                          <span>
                            {step.status === "done"
                              ? "Evidencia declarada"
                              : "Razón de omisión"}
                          </span>
                          {step.evidenceNote}
                        </p>
                      </div>
                    )}

                    {step.status === "blocked" && step.blockerNote && (
                      <div className={styles.blocker}>
                        <AlertTriangle size={15} />
                        <p><span>Bloqueo vigente</span>{step.blockerNote}</p>
                      </div>
                    )}

                    {!closed && canEdit && (
                      <div className={styles.stepActions}>
                        {step.status === "pending" && (
                          <button
                            type="button"
                            disabled={pendingId === step.id}
                            onClick={() => void transition(step.id, "in_progress")}
                          >
                            <Play size={13} /> Iniciar
                          </button>
                        )}
                        {step.status === "blocked" && (
                          <button
                            type="button"
                            disabled={pendingId === step.id}
                            onClick={() => void transition(step.id, "in_progress")}
                          >
                            <Play size={13} /> Reanudar
                          </button>
                        )}
                        {step.status !== "pending" && (
                          <button
                            type="button"
                            disabled={pendingId === step.id}
                            onClick={() => void transition(step.id, "done")}
                          >
                            <Check size={13} /> Completar
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={pendingId === step.id}
                          onClick={() => void transition(step.id, "blocked")}
                        >
                          <Pause size={13} /> Bloquear
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={pendingId === step.id}
                          onClick={() => void transition(step.id, "skipped")}
                        >
                          <SkipForward size={13} /> Omitir
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={styles.contract}>
          <div className={styles.sectionHeading}>
            <div>
              <span>02 / FRONTERA</span>
              <h2>Contrato operativo</h2>
            </div>
            <ShieldCheck size={19} />
          </div>
          <ul>
            <li><Check size={13} /><p><strong>Snapshot estable</strong><span>La guía no cambia durante la ejecución.</span></p></li>
            <li><Check size={13} /><p><strong>Transiciones autorizadas</strong><span>Responsable, Owner, Admin o Planner.</span></p></li>
            <li><Check size={13} /><p><strong>Evidencia obligatoria</strong><span>Cierre y omisión conservan su razón.</span></p></li>
            <li><Check size={13} /><p><strong>Bloqueos explicables</strong><span>El impedimento permanece visible.</span></p></li>
          </ul>
          {capacityWarnings.length > 0 && (
            <div className={styles.capacityWarnings}>
              <AlertTriangle size={16} />
              <p>
                <strong>Capacidad por revisar</strong>
                {capacityWarnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </p>
            </div>
          )}
          <div className={styles.privacy}>
            <LockKeyhole size={17} />
            <p>
              <strong>Sin vigilancia individual</strong>
              No se observa conexión, presencia, velocidad ni productividad.
            </p>
          </div>
        </aside>
      </div>

      <footer className={styles.actions}>
        <span>{message}</span>
        <div>
          <Link href="/app/board"><ArrowLeft size={14} /> Ver recorridos</Link>
          <Link href={`/app/planning/${ticketId}/guide`}>
            <FileCheck2 size={14} /> Abrir guía fuente
          </Link>
        </div>
      </footer>
    </div>
  );
}
