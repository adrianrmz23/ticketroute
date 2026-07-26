import Link from "next/link";

import { RecoverPasswordForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata = {
  title: "Recuperar contraseña",
};

export default function RecoverPasswordPage() {
  return (
    <AuthShell
      eyebrow="RECUPERACIÓN / ACCESO"
      title="Recupera el control."
      description="Te enviaremos un enlace de un solo uso para definir una contraseña nueva."
      footer={
        <>
          ¿Recordaste tu contraseña?{" "}
          <Link href="/auth/login">Volver al acceso</Link>
        </>
      }
    >
      <RecoverPasswordForm />
    </AuthShell>
  );
}
