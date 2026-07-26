"use client";

import { LoaderCircle, Network } from "lucide-react";
import { useActionState } from "react";

import { runCouncilAction } from "@/features/ai/actions";
import { initialAiActionState } from "@/features/ai/ai-state";

import styles from "@/app/app/operations.module.css";

export function CouncilForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(
    runCouncilAction,
    initialAiActionState,
  );
  return (
    <form className={`${styles.card} ${styles.form}`} action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <header className={styles.cardHeader}>
        <div>
          <p>01 / DELIBERACIÓN</p>
          <h2>Solicitar opiniones independientes</h2>
        </div>
        <span>Máximo 4 voces</span>
      </header>
      <label className={styles.field}>
        <span>Título de la decisión</span>
        <input
          name="title"
          maxLength={160}
          placeholder="Ej. Elegir una estrategia de lanzamiento"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Contexto, alternativas y límites</span>
        <textarea
          name="prompt"
          minLength={10}
          maxLength={12000}
          placeholder="Describe qué debe decidirse, qué evidencia existe, qué alternativas ves y qué restricciones no pueden ignorarse."
          required
        />
        <small>
          Cada adaptador recibe la misma pregunta, pero responde de forma
          independiente. TicketRoute conserva el origen de cada voz.
        </small>
      </label>
      {state.status === "error" && (
        <p className={styles.status} data-kind="error">{state.message}</p>
      )}
      <div className={styles.actions}>
        <span>La síntesis orienta; la decisión final sigue siendo humana.</span>
        <button className={styles.button} disabled={pending}>
          {pending ? <LoaderCircle size={14} /> : <Network size={14} />}
          {pending ? "Consultando…" : "Convocar Consejo"}
        </button>
      </div>
    </form>
  );
}
