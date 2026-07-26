"use client";

import { CheckCircle2, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { saveCalibrationAction } from "@/features/calibration/actions";
import { initialCalibrationActionState } from "@/features/calibration/calibration-state";

import styles from "@/app/app/operations.module.css";

type CalibrationRecord = {
  status: "draft" | "confirmed";
  actualValue: number;
  interruptionCount: number;
  scopeChanged: boolean;
  unexpectedBlockers: string[];
  unexpectedDependencies: string[];
  deviationCause: string;
  selectedScenario: "favorable" | "probable" | "adverse" | "outside";
  learningSummary: string;
} | null;

export function CalibrationForm({
  ticketId,
  estimatedLow,
  estimatedHigh,
  unitLabel,
  record,
}: {
  ticketId: string;
  estimatedLow: number;
  estimatedHigh: number;
  unitLabel: string;
  record: CalibrationRecord;
}) {
  const [state, action, pending] = useActionState(
    saveCalibrationAction,
    initialCalibrationActionState,
  );
  const immutable = record?.status === "confirmed";

  return (
    <form className={`${styles.card} ${styles.form}`} action={action}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <header className={styles.cardHeader}>
        <div>
          <p>01 / COMPARACIÓN DECLARADA</p>
          <h2>Rango previsto frente al resultado real</h2>
        </div>
        <span>
          {estimatedLow}–{estimatedHigh} {unitLabel}
        </span>
      </header>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Resultado real ({unitLabel})</span>
          <input
            name="actualValue"
            type="number"
            min="0.1"
            max="100000"
            step="0.1"
            defaultValue={record?.actualValue ?? estimatedHigh}
            disabled={immutable}
            required
          />
          <small>Dato declarado al cerrar el trabajo; no es telemetría.</small>
        </label>
        <label className={styles.field}>
          <span>Interrupciones relevantes</span>
          <input
            name="interruptionCount"
            type="number"
            min="0"
            max="1000"
            defaultValue={record?.interruptionCount ?? 0}
            disabled={immutable}
            required
          />
          <small>Cuenta eventos que alteraron materialmente el recorrido.</small>
        </label>
        <label className={styles.field}>
          <span>Escenario que realmente ocurrió</span>
          <select
            name="selectedScenario"
            defaultValue={record?.selectedScenario ?? "probable"}
            disabled={immutable}
          >
            <option value="favorable">Favorable</option>
            <option value="probable">Probable</option>
            <option value="adverse">Adverso</option>
            <option value="outside">Fuera del rango</option>
          </select>
        </label>
        <label className={styles.checkField}>
          <input
            name="scopeChanged"
            type="checkbox"
            defaultChecked={record?.scopeChanged ?? false}
            disabled={immutable}
          />
          <span>El alcance cambió durante la ejecución</span>
          <small>Haz explícita esta señal antes de reutilizar el resultado.</small>
        </label>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Bloqueos inesperados</span>
          <textarea
            name="unexpectedBlockers"
            defaultValue={record?.unexpectedBlockers.join("\n") ?? ""}
            disabled={immutable}
            placeholder="Uno por línea"
          />
        </label>
        <label className={styles.field}>
          <span>Dependencias inesperadas</span>
          <textarea
            name="unexpectedDependencies"
            defaultValue={record?.unexpectedDependencies.join("\n") ?? ""}
            disabled={immutable}
            placeholder="Una por línea"
          />
        </label>
        <label className={styles.field}>
          <span>Causa principal de la desviación</span>
          <textarea
            name="deviationCause"
            defaultValue={record?.deviationCause ?? ""}
            disabled={immutable}
            placeholder="Explica qué movió el resultado y qué evidencia lo respalda."
          />
        </label>
        <label className={styles.field}>
          <span>Aprendizaje reutilizable</span>
          <textarea
            name="learningSummary"
            defaultValue={record?.learningSummary ?? ""}
            disabled={immutable}
            placeholder="Qué cambiarías en el siguiente ticket comparable."
          />
        </label>
      </div>

      {immutable ? (
        <div className={styles.status} data-kind="success">
          <CheckCircle2 size={14} /> Registro confirmado. Se conserva como
          evidencia histórica y no puede editarse silenciosamente.
        </div>
      ) : (
        <footer className={styles.actions}>
          <span aria-live="polite">
            {state.status !== "idle" ? state.message : "Borrador editable"}
          </span>
          <div>
            <button
              className={styles.secondaryButton}
              name="status"
              value="draft"
              type="submit"
              disabled={pending}
            >
              <Save size={14} /> Guardar borrador
            </button>{" "}
            <button
              className={styles.button}
              name="status"
              value="confirmed"
              type="submit"
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}
              Confirmar aprendizaje
            </button>
          </div>
        </footer>
      )}
    </form>
  );
}
