import Link from "next/link";

import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";
import {
  AuthShell,
} from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/auth-forms";

export const metadata = {
  title: "Iniciar sesión",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    message?: string;
    error?: string;
  }>;
};

const notices: Record<string, string> = {
  "password-updated":
    "Tu contraseña cambió correctamente. Inicia sesión nuevamente.",
  "signed-out": "La sesión se cerró de forma segura.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params.next);
  const notice = params.error
    ? {
        message: "No fue posible completar el enlace de autenticación.",
        tone: "error" as const,
      }
    : params.message
      ? {
          message: notices[params.message],
          tone: "success" as const,
        }
      : undefined;

  return (
    <AuthShell
      eyebrow="ACCESO / WORKSPACE"
      title="Vuelve al centro de control."
      description="Continúa donde tu equipo dejó la operación, con una sesión validada en servidor."
      footer={
        <>
          ¿Aún no tienes una cuenta?{" "}
          <Link
            href={`/auth/register?next=${encodeURIComponent(next)}`}
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginForm
        next={next}
        notice={notice}
      />
    </AuthShell>
  );
}
