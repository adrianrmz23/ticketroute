import { createHash } from "node:crypto";

import { ShieldCheck, UserRoundPlus } from "lucide-react";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { invitationTokenSchema } from "@/domain/workspaces/workspace-schemas";
import { workspaceRoleLabels } from "@/domain/workspaces/workspace";
import { acceptInviteAction } from "@/features/workspaces/actions";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/features/workspaces/components/workspace-gate.module.css";

export const metadata = {
  title: "Invitación de workspace",
};

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { token } = await params;
  const { error: queryError } = await searchParams;
  const parsedToken = invitationTokenSchema.safeParse(token);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const tokenHash = parsedToken.success
    ? createHash("sha256").update(parsedToken.data).digest("hex")
    : "";
  const { data } = parsedToken.success
    ? await supabase.rpc("preview_workspace_invite", {
        p_token_hash: tokenHash,
      })
    : { data: null };
  const invite = data?.[0];
  const invalid = !invite || Boolean(queryError);

  return (
    <main className={styles.gatePage}>
      <header className={styles.gateTopbar}>
        <BrandMark />
        <span>Invitación protegida</span>
      </header>

      <section className={styles.inviteCard}>
        <span className={styles.inviteIcon}>
          {invalid ? (
            <ShieldCheck size={27} aria-hidden="true" />
          ) : (
            <UserRoundPlus size={27} aria-hidden="true" />
          )}
        </span>
        <p>WORKSPACE / ACCESO</p>
        <h1>
          {invalid
            ? "Esta invitación no está disponible."
            : `Únete a ${invite.workspace_name}.`}
        </h1>
        <p className={invalid ? styles.inviteError : undefined}>
          {invalid
            ? "El enlace expiró, fue revocado o corresponde a otro correo. Solicita una invitación nueva al administrador."
            : `La invitación coincide con ${user.email}. Revisa el rol antes de confirmar el acceso.`}
        </p>

        {!invalid && (
          <>
            <div className={styles.inviteMeta}>
              <div>
                <span>Rol asignado</span>
                <strong>{workspaceRoleLabels[invite.role]}</strong>
              </div>
              <div>
                <span>Vigencia</span>
                <strong>
                  {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                  }).format(new Date(invite.expires_at))}
                </strong>
              </div>
            </div>
            <form action={acceptInviteAction}>
              <input type="hidden" name="token" value={token} />
              <button className={styles.primaryButton} type="submit">
                <UserRoundPlus size={16} aria-hidden="true" />
                Aceptar invitación
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
