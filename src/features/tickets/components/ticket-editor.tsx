"use client";

import {
  ArrowRight,
  Check,
  History,
  Save,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ticketPriorities,
  ticketPriorityLabels,
  ticketStatuses,
  ticketStatusLabels,
  type TicketDraft,
} from "@/domain/tickets/ticket";
import {
  createTicketFromCaptureAction,
  updateTicketAction,
} from "@/features/tickets/actions";

import styles from "./ticket-editor.module.css";

type TicketEditorProps =
  | {
      variant: "organize";
      workspaceId: string;
      captureId: string;
      originalInput: string;
      initialDraft: TicketDraft;
      ticketId?: never;
      revisionCount?: never;
    }
  | {
      variant: "edit";
      workspaceId: string;
      ticketId: string;
      originalInput: string;
      initialDraft: TicketDraft;
      captureId?: never;
      revisionCount: number;
    };

const listFields = [
  ["scope", "Alcance"],
  ["outOfScope", "Fuera de alcance"],
  ["functionalRequirements", "Requisitos funcionales"],
  ["technicalRequirements", "Requisitos técnicos"],
  ["constraints", "Restricciones"],
  ["acceptanceCriteria", "Criterios de aceptación"],
  ["risks", "Riesgos"],
  ["assumptions", "Supuestos"],
  ["unknowns", "Incógnitas prioritarias"],
  ["dependencies", "Dependencias"],
  ["subtasks", "Subtareas propuestas"],
] as const;

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export function TicketEditor(props: TicketEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.initialDraft);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  function patch<K extends keyof TicketDraft>(key: K, value: TicketDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
  }

  async function submit(nextRoute?: string) {
    setPending(true);
    setMessage(
      props.variant === "organize"
        ? "Confirmando borrador…"
        : "Guardando revisión…",
    );

    if (props.variant === "organize") {
      const result = await createTicketFromCaptureAction({
        workspaceId: props.workspaceId,
        captureId: props.captureId,
        draft,
      });
      if (result?.status === "error") {
        setMessage(result.message);
        setPending(false);
      }
      return;
    }

    const result = await updateTicketAction({
      ticketId: props.ticketId,
      draft,
      changeSummary: "Actualización desde Ticket Studio",
    });
    setMessage(result.message);
    setPending(false);
    if (result.status === "success") {
      setDirty(false);
      if (nextRoute) {
        router.push(nextRoute);
      }
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>
            <span aria-hidden="true" />
            {props.variant === "organize"
              ? "ORGANIZER / REVISIÓN"
              : "TICKET / STUDIO"}
          </p>
          <h1>
            {props.variant === "organize"
              ? "Convierte intención en estructura."
              : "Ticket Studio"}
          </h1>
          <span>
            La entrada original permanece intacta. Cada campo propuesto puede
            editarse antes de confirmar una decisión.
          </span>
        </div>
        <div className={styles.traceStamp}>
          {props.variant === "organize" ? (
            <ShieldCheck size={18} />
          ) : (
            <History size={18} />
          )}
          <span>
            <strong>
              {props.variant === "organize"
                ? "LOCAL 01"
                : String(props.revisionCount).padStart(2, "0")}
            </strong>
            {props.variant === "organize" ? "Explicable" : "Revisiones"}
          </span>
        </div>
      </header>

      <div className={styles.comparison}>
        <aside className={styles.originalPanel}>
          <header>
            <span>FUENTE INALTERADA</span>
            <h2>Entrada original</h2>
          </header>
          <blockquote>{props.originalInput}</blockquote>
          <div>
            <ShieldCheck size={15} />
            <span>
              <strong>No se sobrescribe</strong>
              <small>Disponible para comparación y auditoría</small>
            </span>
          </div>
        </aside>

        <main className={styles.draftPanel}>
          <div className={styles.organizerNote}>
            <span><Check size={13} /> Organización determinista</span>
            <span><Check size={13} /> Sin envío a proveedores</span>
            <span><Check size={13} /> Máximo dos preguntas prioritarias</span>
          </div>

          <div className={styles.primaryFields}>
            <label>
              <span>Título</span>
              <input
                value={draft.title}
                maxLength={160}
                onChange={(event) => patch("title", event.target.value)}
              />
            </label>
            <div className={styles.twoColumns}>
              <label>
                <span>Prioridad sugerida</span>
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    patch(
                      "priority",
                      event.target.value as TicketDraft["priority"],
                    )
                  }
                >
                  {ticketPriorities.map((priority) => (
                    <option value={priority} key={priority}>
                      {ticketPriorityLabels[priority]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fecha objetivo</span>
                <input
                  type="date"
                  value={draft.targetDate}
                  onChange={(event) => patch("targetDate", event.target.value)}
                />
              </label>
            </div>
            {props.variant === "edit" && (
              <label>
                <span>Estado</span>
                <select
                  value={draft.status}
                  onChange={(event) =>
                    patch("status", event.target.value as TicketDraft["status"])
                  }
                >
                  {ticketStatuses.map((status) => (
                    <option value={status} key={status}>
                      {ticketStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(["objective", "problem", "context", "expectedOutcome"] as const).map(
              (key) => (
                <label key={key}>
                  <span>
                    {key === "objective"
                      ? "Objetivo"
                      : key === "problem"
                        ? "Problema"
                        : key === "context"
                          ? "Contexto"
                          : "Resultado esperado"}
                  </span>
                  <textarea
                    value={draft[key]}
                    onChange={(event) => patch(key, event.target.value)}
                  />
                </label>
              ),
            )}
          </div>

          <div className={styles.listGrid}>
            {listFields.map(([key, label]) => (
              <label data-priority={key === "unknowns"} key={key}>
                <span>{label}</span>
                <textarea
                  value={draft[key].join("\n")}
                  placeholder="Un elemento por línea"
                  onChange={(event) => patch(key, lines(event.target.value))}
                />
              </label>
            ))}
          </div>

          <label className={styles.tagsField}>
            <span>Etiquetas · separadas por coma</span>
            <input
              value={draft.labels.join(", ")}
              onChange={(event) =>
                patch(
                  "labels",
                  event.target.value
                    .split(",")
                    .map((label) => label.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>

          <footer className={styles.actions}>
            <span data-dirty={dirty}>
              {message ||
                (dirty
                  ? "Cambios locales pendientes"
                  : props.variant === "edit"
                    ? "Versión sincronizada"
                    : "Borrador listo para revisión")}
            </span>
            <div>
              {props.variant === "edit" && (
                <button
                  className={styles.planningButton}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void submit(`/app/planning/${props.ticketId}`)
                  }
                >
                  <Scale size={15} /> Guardar y estimar
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => void submit()}
              >
                {props.variant === "organize" ? (
                  <>Confirmar ticket <ArrowRight size={15} /></>
                ) : (
                  <><Save size={15} /> Guardar revisión</>
                )}
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
