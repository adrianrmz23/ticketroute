"use client";

import {
  Check,
  Copy,
  LoaderCircle,
  MailPlus,
  Shield,
  Trash2,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  assignableWorkspaceRoles,
  canManageRole,
  canManageWorkspace,
  type WorkspaceMember,
  workspaceRoleLabels,
} from "@/domain/workspaces/workspace";
import type {
  InviteStatus,
  WorkspaceRole,
} from "@/infrastructure/supabase/database.types";
import {
  changeMemberRoleAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/features/workspaces/actions";
import { initialWorkspaceActionState } from "@/features/workspaces/workspace-state";

import styles from "./team-management.module.css";

type PendingInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
};

type TeamManagementProps = {
  workspaceId: string;
  workspaceName: string;
  actorId: string;
  actorRole: WorkspaceRole;
  members: WorkspaceMember[];
  invites: PendingInvite[];
};

function StatusMessage({
  status,
  message,
}: {
  status: "idle" | "error" | "success";
  message: string;
}) {
  if (status === "idle") {
    return null;
  }

  return (
    <small
      className={
        status === "error" ? styles.errorMessage : styles.successMessage
      }
      role={status === "error" ? "alert" : "status"}
    >
      {message}
    </small>
  );
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, formAction, pending] = useActionState(
    createInviteAction,
    initialWorkspaceActionState,
  );
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!state.inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <form className={styles.inviteForm} action={formAction} noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div>
        <label htmlFor="invite-email">Correo del integrante</label>
        <input
          id="invite-email"
          name="email"
          type="email"
          placeholder="persona@equipo.com"
          autoComplete="email"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          required
        />
        {state.fieldErrors?.email && (
          <small className={styles.errorMessage} role="alert">
            {state.fieldErrors.email[0]}
          </small>
        )}
      </div>
      <div>
        <label htmlFor="invite-role">Rol inicial</label>
        <select id="invite-role" name="role" defaultValue="member">
          {assignableWorkspaceRoles.map((role) => (
            <option value={role} key={role}>
              {workspaceRoleLabels[role]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle
            className={styles.spinner}
            size={15}
            aria-hidden="true"
          />
        ) : (
          <MailPlus size={15} aria-hidden="true" />
        )}
        {pending ? "Preparando…" : "Crear invitación"}
      </button>

      <div className={styles.inviteResult} aria-live="polite">
        <StatusMessage status={state.status} message={state.message} />
        {state.inviteUrl && (
          <div>
            <input
              aria-label="Enlace seguro de invitación"
              value={state.inviteUrl}
              readOnly
            />
            <button type="button" onClick={copyInvite}>
              {copied ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

function MemberRow({
  workspaceId,
  member,
  actorId,
  actorRole,
}: {
  workspaceId: string;
  member: WorkspaceMember;
  actorId: string;
  actorRole: WorkspaceRole;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    changeMemberRoleAction,
    initialWorkspaceActionState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    initialWorkspaceActionState,
  );
  const roleOptions: WorkspaceRole[] =
    actorRole === "owner"
      ? ["owner", ...assignableWorkspaceRoles]
      : assignableWorkspaceRoles.filter((role) =>
          canManageRole(actorRole, member.role, role),
        );
  const manageable =
    actorId !== member.userId &&
    roleOptions.length > 0 &&
    canManageRole(actorRole, member.role, member.role);

  return (
    <article className={styles.memberRow}>
      <span className={styles.avatar} aria-hidden="true">
        {member.displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toLocaleUpperCase("es-MX")}
      </span>
      <div className={styles.memberIdentity}>
        <strong>
          {member.displayName}
          {actorId === member.userId && <small>Tú</small>}
        </strong>
        <span>{member.email}</span>
      </div>
      <span className={styles.joinedAt}>
        Desde{" "}
        {new Intl.DateTimeFormat("es-MX", {
          month: "short",
          year: "numeric",
        }).format(new Date(member.joinedAt))}
      </span>

      {manageable ? (
        <form className={styles.roleForm} action={roleAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="userId" value={member.userId} />
          <select
            name="role"
            defaultValue={member.role}
            aria-label={`Rol de ${member.displayName}`}
          >
            {roleOptions.map((role) => (
              <option value={role} key={role}>
                {workspaceRoleLabels[role]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={rolePending}>
            {rolePending ? (
              <LoaderCircle
                className={styles.spinner}
                size={14}
                aria-hidden="true"
              />
            ) : (
              "Guardar"
            )}
          </button>
          <StatusMessage
            status={roleState.status}
            message={roleState.message}
          />
        </form>
      ) : (
        <span className={styles.roleBadge}>
          <Shield size={13} aria-hidden="true" />
          {workspaceRoleLabels[member.role]}
        </span>
      )}

      {manageable && (
        <form
          className={styles.removeForm}
          action={removeAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `¿Retirar a ${member.displayName} de este workspace?`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="userId" value={member.userId} />
          <button
            type="submit"
            disabled={removePending}
            aria-label={`Retirar a ${member.displayName}`}
            title="Retirar del workspace"
          >
            {removePending ? (
              <LoaderCircle
                className={styles.spinner}
                size={15}
                aria-hidden="true"
              />
            ) : (
              <UserMinus size={15} aria-hidden="true" />
            )}
          </button>
          <StatusMessage
            status={removeState.status}
            message={removeState.message}
          />
        </form>
      )}
    </article>
  );
}

function InviteRow({ invite }: { invite: PendingInvite }) {
  const [state, formAction, pending] = useActionState(
    revokeInviteAction,
    initialWorkspaceActionState,
  );

  return (
    <article className={styles.pendingRow}>
      <span>
        <MailPlus size={15} aria-hidden="true" />
      </span>
      <div>
        <strong>{invite.email}</strong>
        <small>
          {workspaceRoleLabels[invite.role]} · vence{" "}
          {new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
          }).format(new Date(invite.expiresAt))}
        </small>
      </div>
      <span className={styles.pendingBadge}>Pendiente</span>
      <form action={formAction}>
        <input type="hidden" name="inviteId" value={invite.id} />
        <button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle
              className={styles.spinner}
              size={14}
              aria-hidden="true"
            />
          ) : (
            <Trash2 size={14} aria-hidden="true" />
          )}
          Revocar
        </button>
        <StatusMessage status={state.status} message={state.message} />
      </form>
    </article>
  );
}

export function TeamManagement({
  workspaceId,
  workspaceName,
  actorId,
  actorRole,
  members,
  invites,
}: TeamManagementProps) {
  const canManage = canManageWorkspace(actorRole);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>
            <span aria-hidden="true" />
            WORKSPACE / ACCESO
          </p>
          <h1>Equipo</h1>
          <span>
            Personas, roles e invitaciones de <strong>{workspaceName}</strong>.
            Los permisos se comprueban nuevamente en PostgreSQL.
          </span>
        </div>
        <div className={styles.memberCount}>
          <UsersRound size={18} aria-hidden="true" />
          <span>
            <strong>{members.length.toString().padStart(2, "0")}</strong>
            integrantes
          </span>
        </div>
      </header>

      {canManage && (
        <section className={styles.invitePanel}>
          <header>
            <div>
              <span>ACCESO CONTROLADO</span>
              <h2>Preparar invitación</h2>
            </div>
            <small>Vigencia · 7 días</small>
          </header>
          <p>
            El enlace contiene un token de un solo uso. La base conserva
            únicamente su hash y exige que el correo autenticado coincida.
          </p>
          <InviteForm workspaceId={workspaceId} />
        </section>
      )}

      <section className={styles.peoplePanel}>
        <header>
          <div>
            <span>MEMBRESÍAS ACTIVAS</span>
            <h2>Directorio del workspace</h2>
          </div>
          <small>RLS + funciones autorizadas</small>
        </header>
        <div className={styles.memberList}>
          {members.map((member) => (
            <MemberRow
              workspaceId={workspaceId}
              member={member}
              actorId={actorId}
              actorRole={actorRole}
              key={member.userId}
            />
          ))}
        </div>
      </section>

      {canManage && (
        <section className={styles.pendingPanel}>
          <header>
            <div>
              <span>INVITACIONES ABIERTAS</span>
              <h2>Pendientes de respuesta</h2>
            </div>
            <small>{invites.length.toString().padStart(2, "0")} activas</small>
          </header>
          {invites.length ? (
            <div className={styles.pendingList}>
              {invites.map((invite) => (
                <InviteRow invite={invite} key={invite.id} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Check size={17} aria-hidden="true" />
              <span>
                <strong>Sin invitaciones pendientes</strong>
                <small>No hay accesos esperando confirmación.</small>
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
