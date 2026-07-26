"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState } from "react";

import { createPrivacyRequestAction } from "@/features/system/actions";
import { initialSystemActionState } from "@/features/system/system-state";

import styles from "@/app/app/operations.module.css";

export function PrivacyRequestForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(
    createPrivacyRequestAction,
    initialSystemActionState,
  );
  return (
    <form className={`${styles.card} ${styles.form}`} action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <header className={styles.cardHeader}>
        <div><p>01 / DERECHOS</p><h2>Solicitar una acción sobre tus datos</h2></div>
        <span>Registro auditable</span>
      </header>
      <label className={styles.field}>
        <span>Tipo de solicitud</span>
        <select name="requestType" defaultValue="export">
          <option value="export">Exportar mis datos</option>
          <option value="correct">Corregir información</option>
          <option value="delete">Solicitar eliminación</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Detalles y alcance</span>
        <textarea
          name="details"
          maxLength={3000}
          placeholder="Describe qué información o periodo debe revisarse."
        />
      </label>
      {state.status !== "idle" && (
        <p className={styles.status} data-kind={state.status}>{state.message}</p>
      )}
      <div className={styles.actions}>
        <span>Eliminar requiere revisión; nunca se ejecuta desde el navegador.</span>
        <button className={styles.button} disabled={pending}>
          {pending ? <LoaderCircle size={14} /> : <Send size={14} />}
          Registrar solicitud
        </button>
      </div>
    </form>
  );
}
