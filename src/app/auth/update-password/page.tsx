import { UpdatePasswordForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata = {
  title: "Actualizar contraseña",
};

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      eyebrow="CREDENCIAL / ACTUALIZACIÓN"
      title="Define una contraseña nueva."
      description="Utiliza al menos ocho caracteres e incluye letras y números. Cerraremos la sesión de recuperación al terminar."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
