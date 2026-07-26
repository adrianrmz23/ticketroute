"use client";

import { LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  confirmEmailAction,
  loginAction,
  recoverPasswordAction,
  registerAction,
  resendSignUpCodeAction,
  updatePasswordAction,
} from "@/features/auth/actions";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/features/auth/auth-state";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

import styles from "./auth.module.css";

type FieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  error?: string[];
};

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  error,
}: FieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        required
      />
      {error && (
        <small id={`${id}-error`} role="alert">
          {error[0]}
        </small>
      )}
    </label>
  );
}

function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending && (
        <LoaderCircle
          className={styles.spinner}
          size={15}
          aria-hidden="true"
        />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}

function ActionMessage({ state }: { state: AuthActionState }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <div
      className={`${styles.actionMessage} ${
        state.status === "success" ? styles.actionSuccess : styles.actionError
      }`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.status === "success" ? (
        <ShieldCheck size={16} aria-hidden="true" />
      ) : (
        <Mail size={16} aria-hidden="true" />
      )}
      <span>{state.message}</span>
    </div>
  );
}

export function OAuthButtons({ next = "/app" }: { next?: string }) {
  const [workingProvider, setWorkingProvider] = useState<
    "google" | "github" | null
  >(null);
  const [error, setError] = useState("");

  async function signIn(provider: "google" | "github") {
    setError("");
    setWorkingProvider(provider);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (oauthError) {
        setError(
          oauthError.message.toLowerCase().includes("not enabled")
            ? "Este proveedor todavía no está habilitado en Supabase."
            : "No pudimos iniciar el acceso social.",
        );
        setWorkingProvider(null);
      }
    } catch {
      setError("Revisa la configuración pública de Supabase.");
      setWorkingProvider(null);
    }
  }

  return (
    <>
      <div className={styles.oauthGrid}>
        <button
          type="button"
          disabled={Boolean(workingProvider)}
          onClick={() => signIn("google")}
        >
          {workingProvider === "google" ? (
            <LoaderCircle
              className={styles.spinner}
              size={16}
              aria-hidden="true"
            />
          ) : (
            <span className={styles.googleMark} aria-hidden="true">
              G
            </span>
          )}
          Google
        </button>
        <button
          type="button"
          disabled={Boolean(workingProvider)}
          onClick={() => signIn("github")}
        >
          {workingProvider === "github" ? (
            <LoaderCircle
              className={styles.spinner}
              size={16}
              aria-hidden="true"
            />
          ) : (
            <span className={styles.githubMark} aria-hidden="true">
              GH
            </span>
          )}
          GitHub
        </button>
      </div>
      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.divider}>
        <span>o continúa con correo</span>
      </div>
    </>
  );
}

export function LoginForm({
  next,
  notice,
}: {
  next?: string;
  notice?: {
    message: string;
    tone: "success" | "error";
  };
}) {
  const [state, formAction] = useActionState(
    loginAction,
    initialAuthActionState,
  );

  return (
    <>
      {notice && (
        <div
          className={`${styles.actionMessage} ${
            notice.tone === "success"
              ? styles.actionSuccess
              : styles.actionError
          }`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "success" ? (
            <ShieldCheck size={16} aria-hidden="true" />
          ) : (
            <Mail size={16} aria-hidden="true" />
          )}
          <span>{notice.message}</span>
        </div>
      )}
      <OAuthButtons next={next} />
      <form className={styles.form} action={formAction} noValidate>
        <input type="hidden" name="next" value={next ?? "/app"} />
        <Field
          id="email"
          label="Correo"
          type="email"
          autoComplete="email"
          placeholder="tu@equipo.com"
          error={state.fieldErrors?.email}
        />
        <Field
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          error={state.fieldErrors?.password}
        />
        <div className={styles.formUtility}>
          <span>Sesión protegida mediante cookies</span>
          <Link href="/auth/recover">¿Olvidaste tu contraseña?</Link>
        </div>
        <ActionMessage state={state} />
        <SubmitButton pendingLabel="Validando…">
          Entrar a TicketRoute
        </SubmitButton>
      </form>
    </>
  );
}

export function RegisterForm({ next = "/app" }: { next?: string }) {
  const [state, formAction] = useActionState(
    registerAction,
    initialAuthActionState,
  );

  return (
    <>
      <OAuthButtons next={next} />
      <form className={styles.form} action={formAction} noValidate>
        <input type="hidden" name="next" value={next} />
        <Field
          id="name"
          label="Nombre"
          autoComplete="name"
          placeholder="Cómo te identificará tu equipo"
          error={state.fieldErrors?.name}
        />
        <Field
          id="email"
          label="Correo de trabajo"
          type="email"
          autoComplete="email"
          placeholder="tu@equipo.com"
          error={state.fieldErrors?.email}
        />
        <div className={styles.twoColumns}>
          <Field
            id="password"
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="8+ caracteres"
            error={state.fieldErrors?.password}
          />
          <Field
            id="confirmPassword"
            label="Confirmar"
            type="password"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            error={state.fieldErrors?.confirmPassword}
          />
        </div>
        <ActionMessage state={state} />
        <SubmitButton pendingLabel="Creando cuenta…">
          Crear cuenta segura
        </SubmitButton>
        <p className={styles.legalCopy}>
          Al continuar aceptas las reglas de uso y privacidad del workspace.
        </p>
      </form>
    </>
  );
}

export function ConfirmEmailForm({
  email,
  next = "/app",
}: {
  email: string;
  next?: string;
}) {
  const [state, formAction] = useActionState(
    confirmEmailAction,
    initialAuthActionState,
  );
  const [resendState, resendAction] = useActionState(
    resendSignUpCodeAction,
    initialAuthActionState,
  );

  return (
    <div className={styles.form}>
      <div className={styles.emailTarget}>
        <Mail size={17} aria-hidden="true" />
        <span>
          <small>Código enviado a</small>
          <strong>{email || "tu correo"}</strong>
        </span>
      </div>

      <form className={styles.form} action={formAction} noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <label className={styles.field} htmlFor="token">
          <span>Código de confirmación</span>
          <input
            className={styles.codeInput}
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            aria-invalid={Boolean(state.fieldErrors?.token)}
            required
          />
          {state.fieldErrors?.token && (
            <small role="alert">{state.fieldErrors.token[0]}</small>
          )}
        </label>
        <ActionMessage state={state} />
        <SubmitButton pendingLabel="Confirmando…">
          Confirmar correo
        </SubmitButton>
      </form>

      <form className={styles.resendForm} action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={!email}>
          Enviar un código nuevo
        </button>
        <ActionMessage state={resendState} />
      </form>
    </div>
  );
}

export function RecoverPasswordForm() {
  const [state, formAction] = useActionState(
    recoverPasswordAction,
    initialAuthActionState,
  );

  return (
    <form className={styles.form} action={formAction} noValidate>
      <Field
        id="email"
        label="Correo de la cuenta"
        type="email"
        autoComplete="email"
        placeholder="tu@equipo.com"
        error={state.fieldErrors?.email}
      />
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Preparando enlace…">
        Enviar enlace seguro
      </SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(
    updatePasswordAction,
    initialAuthActionState,
  );

  return (
    <form className={styles.form} action={formAction} noValidate>
      <Field
        id="password"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="8+ caracteres, letras y números"
        error={state.fieldErrors?.password}
      />
      <Field
        id="confirmPassword"
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="Repite la contraseña"
        error={state.fieldErrors?.confirmPassword}
      />
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Actualizando…">
        Guardar nueva contraseña
      </SubmitButton>
    </form>
  );
}
