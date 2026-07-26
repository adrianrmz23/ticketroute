"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Gauge,
  ListChecks,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import styles from "./demo.module.css";

const sampleRequest =
  "Necesitamos agregar inicio de sesión con Google antes del viernes. El frontend está listo, pero aún no decidimos qué ocurrirá con los usuarios existentes.";

const stages = [
  { id: "capture", label: "Captura" },
  { id: "organized", label: "Ticket" },
  { id: "planned", label: "Escenarios" },
  { id: "confirmed", label: "Plan" },
  { id: "execution", label: "Ejecución" },
  { id: "calibrated", label: "Aprendizaje" },
] as const;

type Stage = (typeof stages)[number]["id"];
type Clarification = "link" | "new-only" | "assumption";
type ScenarioId = "speed" | "balance" | "learning";

const scenarios = [
  {
    id: "speed" as const,
    name: "Entrega rápida",
    owner: "Ana Torres",
    support: "Luis · revisión",
    range: "2–3 días",
    confidence: "72%",
    load: "92%",
    risk: "Concentra conocimiento",
    icon: Zap,
  },
  {
    id: "balance" as const,
    name: "Carga equilibrada",
    owner: "Luis Moreno",
    support: "Ana · apoyo técnico",
    range: "3–5 días",
    confidence: "86%",
    load: "74%",
    risk: "Sesión inicial de 30 min",
    icon: Route,
  },
  {
    id: "learning" as const,
    name: "Transferencia",
    owner: "Sofía Reyes",
    support: "Luis · acompañamiento",
    range: "4–6 días",
    confidence: "68%",
    load: "66%",
    risk: "Mayor duración inicial",
    icon: UsersRound,
  },
];

const clarificationLabels: Record<Clarification, string> = {
  link: "Conservar cuentas y vincular Google",
  "new-only": "Google solamente para usuarios nuevos",
  assumption: "Continuar con un supuesto explícito",
};

function stageIndex(stage: Stage) {
  return stages.findIndex((item) => item.id === stage);
}

export function DemoExperience() {
  const [request, setRequest] = useState(sampleRequest);
  const [stage, setStage] = useState<Stage>("capture");
  const [organizing, setOrganizing] = useState(false);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("balance");
  const [error, setError] = useState("");

  const selectedScenario = useMemo(
    () => scenarios.find((item) => item.id === scenario) ?? scenarios[1],
    [scenario],
  );

  function organizeRequest() {
    if (!request.trim()) {
      setError("Escribe una solicitud antes de continuar.");
      return;
    }

    setError("");
    setOrganizing(true);
    window.setTimeout(() => {
      setOrganizing(false);
      setStage("organized");
    }, 650);
  }

  function compareScenarios() {
    if (!clarification) {
      setError("Selecciona cómo trataremos a los usuarios existentes.");
      return;
    }

    setError("");
    setStage("planned");
  }

  function resetDemo() {
    setRequest(sampleRequest);
    setStage("capture");
    setOrganizing(false);
    setClarification(null);
    setScenario("balance");
    setError("");
  }

  const currentStageIndex = stageIndex(stage);

  return (
    <section className={styles.experience} aria-label="Demo de TicketRoute">
      <header className={styles.experienceHeader}>
        <div>
          <span className={styles.liveDot} aria-hidden="true" />
          DEMO SESSION / TR-2026-001
        </div>
        <button type="button" onClick={resetDemo}>
          <RotateCcw size={14} aria-hidden="true" />
          Reiniciar
        </button>
      </header>

      <div className={styles.stageRail} aria-label="Progreso de la demostración">
        {stages.map((item, index) => {
          const complete = index < currentStageIndex;
          const active = index === currentStageIndex;
          return (
            <div
              className={[
                styles.stage,
                active ? styles.stageActive : "",
                complete ? styles.stageComplete : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={item.id}
            >
              <span>
                {complete ? (
                  <Check size={12} aria-hidden="true" />
                ) : (
                  `0${index + 1}`
                )}
              </span>
              <p>{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className={styles.experienceGrid}>
        <div className={styles.mainStage}>
          {stage === "capture" && (
            <div className={styles.captureStage}>
              <StageHeading
                index="01 / CAPTURA"
                title="Describe el trabajo como realmente llegó."
                copy="Puedes editar el escenario o utilizar el ejemplo preparado."
              />

              <label htmlFor="demo-request">Solicitud del equipo</label>
              <textarea
                id="demo-request"
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={6}
              />

              <div className={styles.inputMeta}>
                <span>{request.trim().split(/\s+/).filter(Boolean).length} palabras</span>
                <span>Entrada manual</span>
                <span>es-MX</span>
              </div>

              {error && <p className={styles.errorMessage}>{error}</p>}

              <div className={styles.stageActions}>
                <span>
                  La entrada permanece en esta sesión de demostración.
                </span>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={organizing}
                  onClick={organizeRequest}
                >
                  {organizing ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      Organizando…
                    </>
                  ) : (
                    <>
                      Organizar solicitud
                      <Sparkles size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {stage === "organized" && (
            <div className={styles.ticketStage}>
              <StageHeading
                index="02 / TICKET ORGANIZADO"
                title="El trabajo ya tiene forma. Falta una decisión."
                copy="TicketRoute prioriza la única pregunta que cambia alcance y estimación."
              />

              <div className={styles.ticketTitle}>
                <span>AUTH-014</span>
                <div>
                  <h3>Agregar inicio de sesión con Google</h3>
                  <p>
                    Habilitar OAuth con Google antes del viernes sin interrumpir
                    el acceso actual.
                  </p>
                </div>
                <small>NEEDS CONTEXT</small>
              </div>

              <div className={styles.ticketDetails}>
                <div>
                  <span>ALCANCE DETECTADO</span>
                  <ul>
                    <li>OAuth con Google</li>
                    <li>Callback y sesión</li>
                    <li>Pruebas de autenticación</li>
                  </ul>
                </div>
                <div>
                  <span>SEÑALES</span>
                  <ul>
                    <li>Frontend listo</li>
                    <li>Fecha objetivo: viernes</li>
                    <li>Dependencia de identidad</li>
                  </ul>
                </div>
              </div>

              <fieldset className={styles.clarification}>
                <legend>
                  ¿Qué debe ocurrir con los usuarios que ya tienen cuenta?
                </legend>
                <p>
                  Esta respuesta modifica migración, pruebas y riesgo de acceso.
                </p>
                <div>
                  {(Object.keys(clarificationLabels) as Clarification[]).map(
                    (option) => (
                      <label
                        className={
                          clarification === option
                            ? styles.clarificationSelected
                            : ""
                        }
                        key={option}
                      >
                        <input
                          type="radio"
                          name="clarification"
                          value={option}
                          checked={clarification === option}
                          onChange={() => {
                            setClarification(option);
                            setError("");
                          }}
                        />
                        <span>
                          {clarification === option ? (
                            <CheckCircle2 size={17} aria-hidden="true" />
                          ) : (
                            <Circle size={17} aria-hidden="true" />
                          )}
                          {clarificationLabels[option]}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              {error && <p className={styles.errorMessage}>{error}</p>}

              <div className={styles.stageActions}>
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => setStage("capture")}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Volver
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={compareScenarios}
                >
                  Comparar escenarios
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {stage === "planned" && (
            <div className={styles.planningStage}>
              <StageHeading
                index="03 / ASSIGNMENT STUDIO"
                title="Compara consecuencias, no solamente personas."
                copy={`Decisión aplicada: ${
                  clarification ? clarificationLabels[clarification] : ""
                }.`}
              />

              <div className={styles.scenarioGrid}>
                {scenarios.map((item) => {
                  const Icon = item.icon;
                  const active = scenario === item.id;
                  return (
                    <button
                      className={[
                        styles.scenarioCard,
                        active ? styles.scenarioActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setScenario(item.id)}
                      key={item.id}
                    >
                      <header>
                        <span>
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        {active && <small>SELECCIONADO</small>}
                      </header>
                      <h3>{item.name}</h3>
                      <p>{item.owner}</p>
                      <span className={styles.support}>{item.support}</span>
                      <dl>
                        <div>
                          <dt>Rango</dt>
                          <dd>{item.range}</dd>
                        </div>
                        <div>
                          <dt>Confianza</dt>
                          <dd>{item.confidence}</dd>
                        </div>
                        <div>
                          <dt>Carga resultante</dt>
                          <dd>{item.load}</dd>
                        </div>
                      </dl>
                      <footer>
                        <span>Riesgo</span>
                        <strong>{item.risk}</strong>
                      </footer>
                    </button>
                  );
                })}
              </div>

              <div className={styles.explanationBar}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <span>POR QUÉ SE RECOMIENDA</span>
                  <p>
                    {scenario === "balance"
                      ? "Mantiene capacidad saludable y conserva apoyo de la persona con mayor experiencia."
                      : scenario === "speed"
                        ? "Reduce el tiempo probable, pero aumenta concentración de conocimiento y carga."
                        : "Amplía la distribución de conocimiento con un rango de entrega mayor."}
                  </p>
                </div>
              </div>

              <div className={styles.stageActions}>
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => setStage("organized")}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Ajustar contexto
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage("confirmed")}
                >
                  Confirmar este plan
                  <Check size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {stage === "confirmed" && (
            <div className={styles.confirmedStage}>
              <span className={styles.confirmedIcon}>
                <CheckCircle2 size={30} aria-hidden="true" />
              </span>
              <p>04 / PLAN CONFIRMADO</p>
              <h2>El trabajo ya tiene una ruta verificable.</h2>
              <span>
                La decisión conserva el contexto, la aclaración y las razones
                de asignación para calibrar futuras estimaciones.
              </span>

              <div className={styles.confirmedSummary}>
                <div>
                  <small>TICKET</small>
                  <strong>AUTH-014</strong>
                </div>
                <div>
                  <small>ESCENARIO</small>
                  <strong>{selectedScenario.name}</strong>
                </div>
                <div>
                  <small>RESPONSABLE</small>
                  <strong>{selectedScenario.owner}</strong>
                </div>
                <div>
                  <small>RANGO</small>
                  <strong>{selectedScenario.range}</strong>
                </div>
              </div>

              <div className={styles.councilSummary}>
                <Bot size={18} aria-hidden="true" />
                <div>
                  <small>COUNCIL MODE / CONTRASTE LOCAL</small>
                  <strong>
                    Dos perspectivas coinciden en conservar acceso existente y
                    hacer reversible la vinculación.
                  </strong>
                </div>
                <span>CRITERIO HUMANO FINAL</span>
              </div>

              <div className={styles.confirmedActions}>
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => setStage("planned")}
                >
                  Revisar escenarios
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage("execution")}
                >
                  Iniciar recorrido
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {stage === "execution" && (
            <div className={styles.executionStage}>
              <StageHeading
                index="05 / EXECUTION BOARD"
                title="Ejecutar con estados, evidencia y límites."
                copy="La demo utiliza declaraciones visibles; no observa presencia, velocidad ni actividad individual."
              />

              <div className={styles.executionProgress}>
                <div>
                  <ListChecks size={19} aria-hidden="true" />
                  <span>
                    <small>PROGRESO DECLARADO</small>
                    <strong>75%</strong>
                  </span>
                </div>
                <progress max="100" value="75">
                  75%
                </progress>
              </div>

              <ol className={styles.demoSteps}>
                {[
                  ["Preparar", "Confirmar cuentas y rollback", "Completado"],
                  ["Construir", "Configurar OAuth y callback", "Completado"],
                  ["Verificar", "Probar acceso nuevo y existente", "En curso"],
                  ["Entregar", "Documentar cambios y recuperación", "Pendiente"],
                ].map(([phase, title, status], index) => (
                  <li
                    className={
                      status === "Completado" ? styles.demoStepDone : ""
                    }
                    key={title}
                  >
                    <span>0{index + 1}</span>
                    <div>
                      <small>{phase}</small>
                      <strong>{title}</strong>
                    </div>
                    <em>{status}</em>
                  </li>
                ))}
              </ol>

              <div className={styles.explanationBar}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <span>EVIDENCIA EXPLÍCITA</span>
                  <p>
                    Callback validado, cuentas existentes conservadas y ruta de
                    recuperación comprobada.
                  </p>
                </div>
              </div>

              <div className={styles.stageActions}>
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => setStage("confirmed")}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Volver al plan
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage("calibrated")}
                >
                  Cerrar y calibrar
                  <Gauge size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {stage === "calibrated" && (
            <div className={styles.confirmedStage}>
              <span className={styles.confirmedIcon}>
                <Gauge size={30} aria-hidden="true" />
              </span>
              <p>06 / CALIBRACIÓN CONFIRMADA</p>
              <h2>La experiencia ya puede mejorar el siguiente plan.</h2>
              <span>
                El resultado conserva estimación, duración real, interrupciones
                y aprendizaje sin convertir una observación en certeza.
              </span>

              <div className={styles.calibrationSummary}>
                <div>
                  <small>ESTIMADO</small>
                  <strong>{selectedScenario.range}</strong>
                </div>
                <div>
                  <small>REAL</small>
                  <strong>4 días</strong>
                </div>
                <div>
                  <small>INTERRUPCIONES</small>
                  <strong>1 declarada</strong>
                </div>
                <div>
                  <small>RESULTADO</small>
                  <strong>Dentro del rango</strong>
                </div>
              </div>

              <div className={styles.councilSummary}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <small>APRENDIZAJE REUTILIZABLE</small>
                  <strong>
                    La vinculación reversible redujo riesgo sin ampliar el
                    rango probable.
                  </strong>
                </div>
                <span>CONFIRMADO</span>
              </div>

              <div className={styles.confirmedActions}>
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => setStage("execution")}
                >
                  Revisar ejecución
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={resetDemo}
                >
                  Ejecutar otra demo
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.tracePanel}>
          <header>
            <span>LIVE TRACE</span>
            <small>{currentStageIndex + 1}/6</small>
          </header>

          <div className={styles.traceList}>
            <TraceItem
              active
              complete={currentStageIndex > 0}
              title="Entrada normalizada"
              meta="Solicitud · es-MX"
            />
            <TraceItem
              active={currentStageIndex >= 1}
              complete={currentStageIndex > 1}
              title="Contexto estructurado"
              meta="14 campos · 1 incógnita"
            />
            <TraceItem
              active={currentStageIndex >= 2}
              complete={currentStageIndex > 2}
              title="Escenarios calculados"
              meta="Velocidad · equilibrio · aprendizaje"
            />
            <TraceItem
              active={currentStageIndex >= 3}
              complete={currentStageIndex > 3}
              title="Decisión confirmada"
              meta="Consejo contrastado · auditoría"
            />
            <TraceItem
              active={currentStageIndex >= 4}
              complete={currentStageIndex > 4}
              title="Ejecución declarada"
              meta="Estados · evidencia · bloqueos"
            />
            <TraceItem
              active={currentStageIndex >= 5}
              complete={currentStageIndex >= 5}
              title="Aprendizaje calibrado"
              meta="Estimado contra resultado real"
            />
          </div>

          <div className={styles.traceEvidence}>
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              CONTROL DE DEMO
            </span>
            <p>Datos locales aislados</p>
            <p>Sin llamadas externas</p>
            <p>Sin cambios en tu workspace</p>
          </div>

          <div className={styles.traceTiming}>
            <Clock3 size={15} aria-hidden="true" />
            <span>
              <small>TIEMPO DEL RECORRIDO</small>
              <strong>≈ 4 minutos</strong>
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

type StageHeadingProps = {
  index: string;
  title: string;
  copy: string;
};

function StageHeading({ index, title, copy }: StageHeadingProps) {
  return (
    <header className={styles.stageHeading}>
      <span>{index}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </header>
  );
}

type TraceItemProps = {
  active: boolean;
  complete: boolean;
  title: string;
  meta: string;
};

function TraceItem({
  active,
  complete,
  title,
  meta,
}: TraceItemProps) {
  return (
    <div
      className={[
        styles.traceItem,
        active ? styles.traceItemActive : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>
        {complete ? (
          <Check size={11} aria-hidden="true" />
        ) : (
          <Circle size={9} aria-hidden="true" />
        )}
      </span>
      <p>
        <strong>{title}</strong>
        <small>{meta}</small>
      </p>
    </div>
  );
}
