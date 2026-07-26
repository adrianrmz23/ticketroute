import Link from "next/link";

import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";
import { RegisterForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata = {
  title: "Crear cuenta",
};

type RegisterPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { next: requestedNext } = await searchParams;
  const next = getSafeRedirectPath(requestedNext);

  return (
    <AuthShell
      eyebrow="ALTA / IDENTIDAD"
      title="Prepara tu espacio de trabajo."
      description="Crea tu identidad. En el siguiente paso confirmaremos el correo antes de permitir acceso privado."
      footer={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`}>
            Iniciar sesión
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
