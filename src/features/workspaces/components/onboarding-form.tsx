"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Database,
  LoaderCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  createWorkspaceSlug,
  type CreateWorkspaceInput,
} from "@/domain/workspaces/workspace-schemas";
import { createWorkspaceAction } from "@/features/workspaces/actions";
import { initialWorkspaceActionState } from "@/features/workspaces/workspace-state";

import styles from "./workspace-gate.module.css";

const stepFields: (keyof CreateWorkspaceInput)[][] = [
  ["name", "slug"],
  ["timezone", "estimationUnit", "weeklyCapacityHours"],
  [
    "defaultAiProvider",
    "dataRetentionDays",
    "deleteAudioAfterTranscription",
  ],
];

const steps = [
  {
    label: "Identidad",
    description: "Nombre y dirección interna",
    icon: UsersRound,
  },
  {
    label: "Planeación",
    description: "Tiempo, capacidad y unidad",
    icon: Clock3,
  },
  {
    label: "Control",
    description: "IA, privacidad y retención",
    icon: ShieldCheck,
  },
];

export function OnboardingForm({
  displayName,
}: {
  displayName: string;
}) {
  const [step, setStep] = useState(0);
  const activationRequested = useRef(false);
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    initialWorkspaceActionState,
  );
  const {
    register,
    setValue,
    trigger,
    control,
    formState: { dirtyFields, errors },
  } = useForm<CreateWorkspaceInput>({
    defaultValues: {
      name: "TicketRoute Lab",
      slug: "ticketroute-lab",
      timezone: "America/Mexico_City",
      estimationUnit: "days",
      weeklyCapacityHours: 40,
      defaultAiProvider: "manual",
      dataRetentionDays: 365,
      deleteAudioAfterTranscription: true,
    },
    mode: "onBlur",
  });

  const [
    workspaceName,
    workspaceSlug,
    estimationUnit,
    weeklyCapacity,
    aiProvider,
    retention,
  ] = useWatch({
    control,
    name: [
      "name",
      "slug",
      "estimationUnit",
      "weeklyCapacityHours",
      "defaultAiProvider",
      "dataRetentionDays",
    ],
  });

  useEffect(() => {
    if (!dirtyFields.slug) {
      setValue(
        "slug",
        createWorkspaceSlug(workspaceName) || "ticketroute-lab",
      );
    }
  }, [dirtyFields.slug, setValue, workspaceName]);

  async function goNext() {
    const valid = await trigger(stepFields[step], { shouldFocus: true });
    if (valid) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  return (
    <form
      className={styles.onboardingForm}
      action={formAction}
      noValidate
      onSubmit={(event) => {
        if (!activationRequested.current) {
          event.preventDefault();
          if (step < steps.length - 1) {
            void goNext();
          }
        }
      }}
    >
      <ol className={styles.stepRail} aria-label="Progreso de configuración">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const active = index === step;
          const complete = index < step;

          return (
            <li
              className={active ? styles.stepActive : ""}
              data-complete={complete}
              key={item.label}
            >
              <span>
                {complete ? (
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <Icon size={15} aria-hidden="true" />
                )}
              </span>
              <p>
                <small>0{index + 1}</small>
                <strong>{item.label}</strong>
                <em>{item.description}</em>
              </p>
            </li>
          );
        })}
      </ol>

      <div className={styles.formStage}>
        <header className={styles.stageHeader}>
          <p>CONFIGURACIÓN / 0{step + 1}</p>
          <h1>
            {step === 0 && `Construyamos tu base, ${displayName}.`}
            {step === 1 && "Define cómo planea tu equipo."}
            {step === 2 && "Establece la frontera de control."}
          </h1>
          <span>
            {step === 0 &&
              "El workspace separa personas, tickets y decisiones de cualquier otra organización."}
            {step === 1 &&
              "Estos valores serán la referencia inicial para capacidad y estimaciones explicables."}
            {step === 2 &&
              "La IA permanecerá desactivada hasta que conectes un proveedor y autorices su uso."}
          </span>
        </header>

        <fieldset className={styles.fields} hidden={step !== 0}>
          <legend className={styles.visuallyHidden}>
            Identidad del workspace
          </legend>
          <label>
            <span>Nombre del workspace</span>
            <input
              {...register("name", {
                required: "Escribe el nombre del workspace",
                minLength: {
                  value: 2,
                  message: "Escribe al menos 2 caracteres",
                },
                maxLength: {
                  value: 80,
                  message: "Máximo 80 caracteres",
                },
              })}
              aria-invalid={Boolean(errors.name || state.fieldErrors?.name)}
              autoComplete="organization"
            />
            {(errors.name?.message || state.fieldErrors?.name?.[0]) && (
              <small role="alert">
                {errors.name?.message ?? state.fieldErrors?.name?.[0]}
              </small>
            )}
          </label>

          <label>
            <span>Identificador interno</span>
            <div className={styles.slugField}>
              <small>ticketroute.local/</small>
              <input
                {...register("slug", {
                  required: "Escribe un identificador",
                  pattern: {
                    value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: "Usa minúsculas, números y guiones",
                  },
                  minLength: {
                    value: 2,
                    message: "Escribe al menos 2 caracteres",
                  },
                })}
                aria-invalid={Boolean(errors.slug || state.fieldErrors?.slug)}
                spellCheck={false}
              />
            </div>
            {(errors.slug?.message || state.fieldErrors?.slug?.[0]) && (
              <small role="alert">
                {errors.slug?.message ?? state.fieldErrors?.slug?.[0]}
              </small>
            )}
            <em>Podrás cambiarlo después desde Configuración.</em>
          </label>

          <div className={styles.contextNote}>
            <Database size={18} aria-hidden="true" />
            <p>
              <strong>Aislamiento desde el primer registro</strong>
              <span>
                PostgreSQL creará el workspace y tu membresía Owner dentro de
                una sola transacción.
              </span>
            </p>
          </div>
        </fieldset>

        <fieldset className={styles.fields} hidden={step !== 1}>
          <legend className={styles.visuallyHidden}>
            Preferencias de planeación
          </legend>
          <div className={styles.twoColumns}>
            <label>
              <span>Zona horaria</span>
              <select {...register("timezone", { required: true })}>
                <option value="America/Mexico_City">
                  Ciudad de México (UTC−06)
                </option>
                <option value="America/Cancun">Cancún (UTC−05)</option>
                <option value="America/Tijuana">Tijuana (Pacífico)</option>
                <option value="America/New_York">Nueva York</option>
                <option value="Europe/Madrid">Madrid</option>
                <option value="UTC">UTC</option>
              </select>
            </label>

            <label>
              <span>Unidad de estimación</span>
              <select {...register("estimationUnit")}>
                <option value="days">Días</option>
                <option value="hours">Horas</option>
                <option value="points">Puntos</option>
              </select>
            </label>
          </div>

          <label>
            <span>Capacidad semanal de referencia</span>
            <div className={styles.unitField}>
              <input
                {...register("weeklyCapacityHours", {
                  valueAsNumber: true,
                  required: "Indica la capacidad",
                  min: { value: 1, message: "Mínimo 1 hora" },
                  max: { value: 168, message: "Máximo 168 horas" },
                })}
                aria-invalid={Boolean(errors.weeklyCapacityHours)}
                inputMode="numeric"
                type="number"
              />
              <small>horas / persona</small>
            </div>
            {errors.weeklyCapacityHours?.message && (
              <small role="alert">
                {errors.weeklyCapacityHours.message}
              </small>
            )}
            <em>
              Es una referencia de planeación, nunca una métrica de vigilancia.
            </em>
          </label>

          <div className={styles.previewStrip}>
            <span>BASE DE PLANEACIÓN</span>
            <strong>
              {weeklyCapacity || 0} h semanales ·{" "}
              {estimationUnit === "days"
                ? "estimaciones en días"
                : estimationUnit === "hours"
                  ? "estimaciones en horas"
                  : "estimaciones en puntos"}
            </strong>
          </div>
        </fieldset>

        <fieldset className={styles.fields} hidden={step !== 2}>
          <legend className={styles.visuallyHidden}>
            IA, privacidad y retención
          </legend>
          <label>
            <span>Proveedor de IA predeterminado</span>
            <div className={styles.selectWithIcon}>
              <Bot size={17} aria-hidden="true" />
              <select {...register("defaultAiProvider")}>
                <option value="manual">Modo manual · sin proveedor</option>
                <option value="openai">OpenAI · conectar después</option>
                <option value="anthropic">Claude · conectar después</option>
                <option value="gemini">Gemini · conectar después</option>
              </select>
            </div>
            <em>
              Esta elección no envía información ni solicita claves todavía.
            </em>
          </label>

          <label>
            <span>Retención operativa predeterminada</span>
            <select
              {...register("dataRetentionDays", { valueAsNumber: true })}
            >
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
              <option value={180}>180 días</option>
              <option value={365}>1 año</option>
              <option value={730}>2 años</option>
            </select>
          </label>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              {...register("deleteAudioAfterTranscription")}
            />
            <span aria-hidden="true">
              <Check size={13} />
            </span>
            <p>
              <strong>Eliminar audio después de transcribir</strong>
              <em>
                TicketRoute conservará únicamente la transcripción salvo
                consentimiento explícito posterior.
              </em>
            </p>
          </label>

          <div className={styles.summaryGrid}>
            <div>
              <span>Workspace</span>
              <strong>{workspaceName || "Sin nombre"}</strong>
              <small>{workspaceSlug || "sin-identificador"}</small>
            </div>
            <div>
              <span>IA inicial</span>
              <strong>
                {aiProvider === "manual" ? "Manual" : aiProvider}
              </strong>
              <small>Sin envío automático</small>
            </div>
            <div>
              <span>Retención</span>
              <strong>{retention} días</strong>
              <small>Política editable</small>
            </div>
          </div>
        </fieldset>

        {state.status === "error" && (
          <div className={styles.errorMessage} role="alert">
            {state.message}
          </div>
        )}

        <footer className={styles.formActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={step === 0 || pending}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Anterior
          </button>

          {step < steps.length - 1 ? (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={goNext}
            >
              Continuar
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={pending}
              onClick={() => {
                activationRequested.current = true;
              }}
            >
              {pending ? (
                <LoaderCircle
                  className={styles.spinner}
                  size={16}
                  aria-hidden="true"
                />
              ) : (
                <ShieldCheck size={16} aria-hidden="true" />
              )}
              {pending ? "Creando workspace…" : "Activar workspace"}
            </button>
          )}
        </footer>
      </div>
    </form>
  );
}
