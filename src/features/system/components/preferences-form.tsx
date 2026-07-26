"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useActionState } from "react";

import { saveNotificationPreferencesAction } from "@/features/system/actions";
import { initialSystemActionState } from "@/features/system/system-state";

import styles from "@/app/app/operations.module.css";

type Preference = {
  inApp: boolean;
  email: boolean;
  blockedSteps: boolean;
  assignments: boolean;
  invitations: boolean;
  councilResults: boolean;
  digestFrequency: "never" | "daily" | "weekly";
};

export function PreferencesForm({
  workspaceId,
  preference,
  emailAvailable,
}: {
  workspaceId: string;
  preference: Preference;
  emailAvailable: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveNotificationPreferencesAction,
    initialSystemActionState,
  );
  return (
    <form className={`${styles.card} ${styles.form}`} action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <header className={styles.cardHeader}>
        <div><p>02 / PREFERENCIAS</p><h2>Qué merece interrumpirte</h2></div>
        <span>Por persona</span>
      </header>
      <div className={styles.formGrid}>
        {[
          ["inApp", "Centro de notificaciones", preference.inApp],
          ["blockedSteps", "Pasos bloqueados", preference.blockedSteps],
          ["assignments", "Asignaciones", preference.assignments],
          ["invitations", "Invitaciones", preference.invitations],
          ["councilResults", "Resultados del Consejo", preference.councilResults],
        ].map(([name, label, checked]) => (
          <label className={styles.checkField} key={String(name)}>
            <input
              name={String(name)}
              type="checkbox"
              defaultChecked={Boolean(checked)}
            />
            <span>{String(label)}</span>
          </label>
        ))}
        <label className={styles.checkField}>
          <input
            name="email"
            type="checkbox"
            defaultChecked={preference.email && emailAvailable}
            disabled={!emailAvailable}
          />
          <span>
            Correo electrónico
            {!emailAvailable ? " · requiere webhook privado" : ""}
          </span>
        </label>
      </div>
      {emailAvailable ? (
        <label className={styles.field}>
          <span>Ventana de entrega por correo</span>
          <select
            name="digestFrequency"
            defaultValue={preference.digestFrequency}
          >
            <option value="never">No enviar</option>
            <option value="daily">Siguiente ventana diaria</option>
            <option value="weekly">Siguiente ventana semanal</option>
          </select>
        </label>
      ) : (
        <>
          <input type="hidden" name="digestFrequency" value="never" />
          <p className={styles.status}>
            El SMTP de Supabase protege correos de acceso. Las notificaciones
            operativas requieren NOTIFICATION_EMAIL_WEBHOOK_URL en el servidor.
          </p>
        </>
      )}
      {state.status !== "idle" && (
        <p className={styles.status} data-kind={state.status}>{state.message}</p>
      )}
      <div className={styles.actions}>
        <span>
          {emailAvailable
            ? "Los correos se procesan por la cola asíncrona."
            : "La bandeja en tiempo real funciona sin configurar correo operativo."}
        </span>
        <button className={styles.button} disabled={pending}>
          {pending ? <LoaderCircle size={14} /> : <Save size={14} />}
          Guardar preferencias
        </button>
      </div>
    </form>
  );
}
