import Link from "next/link";

import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";
import { ConfirmEmailForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata = {
  title: "Confirmar correo",
};

type ConfirmPageProps = {
  searchParams: Promise<{ email?: string; next?: string }>;
};

export default async function ConfirmPage({
  searchParams,
}: ConfirmPageProps) {
  const { email = "", next: requestedNext } = await searchParams;
  const next = getSafeRedirectPath(requestedNext);

  return (
    <AuthShell
      eyebrow="VERIFICACIÓN / 6 DÍGITOS"
      title="Confirma que eres tú."
      description="Escribe el código de seis dígitos enviado por Supabase. Al validarlo se abrirá tu sesión SSR."
      footer={
        <>
          ¿Usaste otro correo?{" "}
          <Link
            href={`/auth/register?next=${encodeURIComponent(next)}`}
          >
            Volver al registro
          </Link>
        </>
      }
    >
      <ConfirmEmailForm email={email} next={next} />
    </AuthShell>
  );
}
