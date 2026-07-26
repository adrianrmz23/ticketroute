"use client";

import { KeyRound, LoaderCircle, Save } from "lucide-react";
import { useActionState } from "react";

import {
  providerDefaults,
  providerLabels,
  type AiProvider,
} from "@/domain/ai/ai-schemas";
import { saveProviderConfigAction } from "@/features/ai/actions";
import { initialAiActionState } from "@/features/ai/ai-state";

import styles from "@/app/app/operations.module.css";

export function ProviderConfigForm({
  workspaceId,
  provider,
  config,
}: {
  workspaceId: string;
  provider: AiProvider;
  config:
    | {
        model: string;
        enabled: boolean;
        isDefault: boolean;
        secretConfigured: boolean;
      }
    | undefined;
}) {
  const [state, action, pending] = useActionState(
    saveProviderConfigAction,
    initialAiActionState,
  );

  return (
    <form className={`${styles.card} ${styles.form}`} action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <header className={styles.cardHeader}>
        <div>
          <p>ADAPTADOR / {provider.toLocaleUpperCase("es-MX")}</p>
          <h2>{providerLabels[provider]}</h2>
        </div>
        <span className={styles.chip}>
          <KeyRound size={11} />{" "}
          {config?.secretConfigured || provider === "manual"
            ? "Servidor listo"
            : "Sin credencial"}
        </span>
      </header>
      <label className={styles.field}>
        <span>Modelo</span>
        <input
          name="model"
          defaultValue={config?.model ?? providerDefaults[provider]}
          maxLength={120}
          required
        />
        <small>
          Se guarda el identificador; la clave nunca se envía a Supabase.
        </small>
      </label>
      <div className={styles.formGrid}>
        <label className={styles.checkField}>
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={config?.enabled ?? provider === "manual"}
          />
          <span>Habilitado para Council Mode</span>
        </label>
        <label className={styles.checkField}>
          <input
            name="isDefault"
            type="checkbox"
            defaultChecked={config?.isDefault ?? false}
          />
          <span>Proveedor predeterminado</span>
        </label>
      </div>
      {state.status !== "idle" && (
        <p className={styles.status} data-kind={state.status}>
          {state.message}
        </p>
      )}
      <div className={styles.actions}>
        <span>Solo Owner y Admin pueden cambiar esta configuración.</span>
        <button className={styles.button} disabled={pending}>
          {pending ? <LoaderCircle size={14} /> : <Save size={14} />}
          Guardar adaptador
        </button>
      </div>
    </form>
  );
}
