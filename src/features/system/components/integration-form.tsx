"use client";

import { Cable, LoaderCircle, Save } from "lucide-react";
import { useActionState } from "react";

import {
  integrationLabels,
  type IntegrationProvider,
} from "@/domain/system/system-schemas";
import { saveIntegrationAction } from "@/features/system/actions";
import { initialSystemActionState } from "@/features/system/system-state";

import styles from "@/app/app/operations.module.css";

export function IntegrationForm({
  workspaceId,
  provider,
  integration,
}: {
  workspaceId: string;
  provider: IntegrationProvider;
  integration:
    | {
        displayName: string;
        endpoint: string;
        enabled: boolean;
        secretConfigured: boolean;
      }
    | undefined;
}) {
  const serverEndpointOnly = provider === "webhook" || provider === "slack";
  const [state, action, pending] = useActionState(
    saveIntegrationAction,
    initialSystemActionState,
  );
  return (
    <form className={`${styles.card} ${styles.form}`} action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <header className={styles.cardHeader}>
        <div><p>CONECTOR / {provider.toUpperCase()}</p><h2>{integrationLabels[provider]}</h2></div>
        <span className={styles.chip}>
          <Cable size={11} />{" "}
          {integration?.secretConfigured ? "Credencial lista" : "Sin secreto"}
        </span>
      </header>
      <label className={styles.field}>
        <span>Nombre visible</span>
        <input
          name="displayName"
          defaultValue={integration?.displayName ?? integrationLabels[provider]}
          required
        />
      </label>
      <label className={styles.field}>
        <span>
          {serverEndpointOnly
            ? "Destino privado"
            : "URL base no secreta (opcional)"}
        </span>
        <input
          name="endpoint"
          type="url"
          defaultValue={serverEndpointOnly ? "" : integration?.endpoint ?? ""}
          placeholder={
            serverEndpointOnly
              ? "Configurado mediante variable del servidor"
              : "https://api.ejemplo.com"
          }
          readOnly={serverEndpointOnly}
          aria-describedby={`endpoint-help-${provider}`}
        />
        <small id={`endpoint-help-${provider}`}>
          {serverEndpointOnly
            ? "La URL completa permanece en una variable privada y nunca se guarda en PostgreSQL."
            : "No se aceptan credenciales, query strings ni fragmentos."}
        </small>
      </label>
      <label className={styles.checkField}>
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={integration?.enabled ?? false}
        />
        <span>Habilitar entrega de eventos</span>
      </label>
      {state.status !== "idle" && (
        <p className={styles.status} data-kind={state.status}>{state.message}</p>
      )}
      <div className={styles.actions}>
        <span>La entrega se realiza fuera de la petición web.</span>
        <button className={styles.button} disabled={pending}>
          {pending ? <LoaderCircle size={14} /> : <Save size={14} />}
          Guardar conector
        </button>
      </div>
    </form>
  );
}
