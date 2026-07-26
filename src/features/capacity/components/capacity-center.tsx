"use client";

import {
  ArrowLeft,
  BookOpenCheck,
  Boxes,
  Check,
  Gauge,
  LoaderCircle,
  Radar,
  Save,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  canEditPlanningProfile,
  capacityLevelLabels,
  getCapacityLevel,
  getCapacityPercentage,
  type CapacityMember,
} from "@/domain/capacity/capacity";
import { workspaceRoleLabels } from "@/domain/workspaces/workspace";
import { savePlanningProfileAction } from "@/features/capacity/actions";
import { initialCapacityActionState } from "@/features/capacity/capacity-state";
import type { WorkspaceRole } from "@/infrastructure/supabase/database.types";

import styles from "./capacity-center.module.css";

type CapacityCenterProps = {
  workspaceId: string;
  workspaceName: string;
  fallbackWeeklyHours: number;
  actorId: string;
  actorRole: WorkspaceRole;
  members: CapacityMember[];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-MX");
}

function listValue(values: string[]) {
  return values.join(", ");
}

function MemberEditor({
  workspaceId,
  actorId,
  actorRole,
  member,
}: {
  workspaceId: string;
  actorId: string;
  actorRole: WorkspaceRole;
  member: CapacityMember;
}) {
  const [state, action, pending] = useActionState(
    savePlanningProfileAction,
    initialCapacityActionState,
  );
  const editable = canEditPlanningProfile(
    actorId,
    actorRole,
    member.userId,
  );
  const profile = member.profile;

  return (
    <form className={styles.editor} action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="userId" value={member.userId} />

      <header className={styles.editorHeader}>
        <span className={styles.largeAvatar}>{initials(member.displayName)}</span>
        <div>
          <span>02 / PERFIL DECLARADO</span>
          <h2>{member.displayName}</h2>
          <p>
            {member.email} · {workspaceRoleLabels[member.role]}
            {member.userId === actorId ? " · Tu perfil" : ""}
          </p>
        </div>
        <span className={styles.editBadge}>
          <UserRoundCog size={14} />
          {editable ? "Editable" : "Solo lectura"}
        </span>
      </header>

      <div className={styles.hoursGrid}>
        <label>
          <span>Disponibilidad semanal</span>
          <div>
            <input
              name="availabilityHours"
              type="number"
              min={1}
              max={168}
              step={0.5}
              defaultValue={profile?.availabilityHours ?? ""}
              placeholder="Sin declarar"
              disabled={!editable}
            />
            <b>h</b>
          </div>
          <small>Tiempo que esta persona decide ofrecer al workspace.</small>
          {state.fieldErrors?.availabilityHours && (
            <em>{state.fieldErrors.availabilityHours[0]}</em>
          )}
        </label>
        <label>
          <span>Horas ya planeadas</span>
          <div>
            <input
              name="plannedHours"
              type="number"
              min={0}
              max={168}
              step={0.5}
              defaultValue={profile?.plannedHours ?? 0}
              disabled={!editable}
            />
            <b>h</b>
          </div>
          <small>Compromisos conocidos, no actividad observada.</small>
          {state.fieldErrors?.plannedHours && (
            <em>{state.fieldErrors.plannedHours[0]}</em>
          )}
        </label>
        <div className={styles.loadPreview}>
          <span>Carga declarada</span>
          <strong>
            {getCapacityPercentage(profile) === null
              ? "—"
              : `${getCapacityPercentage(profile)}%`}
          </strong>
          <small>{capacityLevelLabels[getCapacityLevel(profile)]}</small>
        </div>
      </div>

      <div className={styles.signalGrid}>
        <label>
          <span>
            <Sparkles size={14} /> Habilidades
          </span>
          <textarea
            name="skills"
            defaultValue={listValue(profile?.skills ?? [])}
            placeholder="React, TypeScript, investigación"
            disabled={!editable}
          />
          <small>Separa cada señal con coma o salto de línea.</small>
        </label>
        <label>
          <span>
            <Boxes size={14} /> Experiencia en componentes
          </span>
          <textarea
            name="componentExperience"
            defaultValue={listValue(profile?.componentExperience ?? [])}
            placeholder="Checkout, autenticación, notificaciones"
            disabled={!editable}
          />
          <small>Áreas donde ya existe contexto verificable.</small>
        </label>
        <label>
          <span>
            <Radar size={14} /> Ownership técnico
          </span>
          <textarea
            name="technicalOwnership"
            defaultValue={listValue(profile?.technicalOwnership ?? [])}
            placeholder="Frontend, API pública, infraestructura"
            disabled={!editable}
          />
          <small>Responsabilidades explícitas, no títulos inferidos.</small>
        </label>
        <label>
          <span>
            <BookOpenCheck size={14} /> Objetivos de aprendizaje
          </span>
          <textarea
            name="learningGoals"
            defaultValue={listValue(profile?.learningGoals ?? [])}
            placeholder="PostgreSQL, RLS, accesibilidad"
            disabled={!editable}
          />
          <small>Se usan únicamente en escenarios de transferencia.</small>
        </label>
      </div>

      <footer className={styles.editorFooter}>
        <div aria-live="polite">
          {state.status !== "idle" && (
            <span data-status={state.status}>
              {state.status === "success" && <Check size={13} />}
              {state.message}
            </span>
          )}
          {!state.message && (
            <small>
              Última declaración:{" "}
              {profile?.updatedAt
                ? new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                  }).format(new Date(profile.updatedAt))
                : "todavía no existe"}
            </small>
          )}
        </div>
        {editable && (
          <button type="submit" disabled={pending}>
            {pending ? (
              <LoaderCircle className={styles.spinner} size={15} />
            ) : (
              <Save size={15} />
            )}
            {pending ? "Guardando…" : "Guardar declaración"}
          </button>
        )}
      </footer>
    </form>
  );
}

export function CapacityCenter({
  workspaceId,
  workspaceName,
  fallbackWeeklyHours,
  actorId,
  actorRole,
  members,
}: CapacityCenterProps) {
  const [selectedId, setSelectedId] = useState(
    members.find((member) => member.userId === actorId)?.userId ??
      members[0]?.userId ??
      "",
  );
  const selected =
    members.find((member) => member.userId === selectedId) ?? members[0];
  const summary = useMemo(() => {
    const declared = members.filter(
      (member) => typeof member.profile?.availabilityHours === "number",
    );
    const available = declared.reduce(
      (total, member) =>
        total + (member.profile?.availabilityHours ?? 0),
      0,
    );
    const planned = declared.reduce(
      (total, member) => total + (member.profile?.plannedHours ?? 0),
      0,
    );
    return {
      declared: declared.length,
      available,
      planned,
      headroom: available - planned,
    };
  }, [members]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>
            <span aria-hidden="true" /> EQUIPO / CAPACIDAD
          </p>
          <h1>Planear capacidad, no vigilar personas.</h1>
          <span>
            {workspaceName} usa disponibilidad, compromisos y conocimiento
            declarados. Cada señal puede revisarse y cambiarse.
          </span>
        </div>
        <div className={styles.traceStamp}>
          <Gauge size={19} />
          <span>
            <strong>10</strong>
            Capacidad declarada
          </span>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Resumen de capacidad">
        <article>
          <span>Integrantes</span>
          <strong>{String(members.length).padStart(2, "0")}</strong>
          <small>{summary.declared} con disponibilidad declarada</small>
        </article>
        <article>
          <span>Disponibilidad</span>
          <strong>{summary.available || "—"}{summary.available ? "h" : ""}</strong>
          <small>Total explícito del equipo</small>
        </article>
        <article>
          <span>Ya planeado</span>
          <strong>
            {summary.declared ? `${summary.planned}h` : "—"}
          </strong>
          <small>Compromisos conocidos</small>
        </article>
        <article>
          <span>Margen visible</span>
          <strong>{summary.declared ? `${summary.headroom}h` : "—"}</strong>
          <small>Puede ser negativo y requiere revisión</small>
        </article>
      </section>

      <div className={styles.workspace}>
        <section className={styles.directory}>
          <div className={styles.sectionHeading}>
            <div>
              <span>01 / PERSONAS</span>
              <h2>Directorio de planeación</h2>
            </div>
            <UsersRound size={18} />
          </div>
          <p>
            El valor de {fallbackWeeklyHours}h del workspace solo funciona como
            fallback cuando alguien aún no declara disponibilidad.
          </p>
          <div className={styles.memberList}>
            {members.map((member) => {
              const level = getCapacityLevel(member.profile);
              const percentage = getCapacityPercentage(member.profile);
              return (
                <button
                  type="button"
                  data-selected={member.userId === selected?.userId}
                  onClick={() => setSelectedId(member.userId)}
                  key={member.userId}
                >
                  <span className={styles.avatar}>
                    {initials(member.displayName)}
                  </span>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>
                      {workspaceRoleLabels[member.role]} ·{" "}
                      {member.activeAssignmentCount} plan(es)
                    </small>
                  </span>
                  <span data-level={level}>
                    {percentage === null ? "—" : `${percentage}%`}
                    <small>{capacityLevelLabels[level]}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <Link href="/app/team">
            <ArrowLeft size={14} /> Volver a Equipo
          </Link>
        </section>

        {selected && (
          <MemberEditor
            key={`${selected.userId}-${selected.profile?.updatedAt ?? "new"}`}
            workspaceId={workspaceId}
            actorId={actorId}
            actorRole={actorRole}
            member={selected}
          />
        )}
      </div>

      <section className={styles.boundary}>
        <div>
          <ShieldCheck size={22} />
          <span>
            <strong>Frontera de uso</strong>
            Estas señales ayudan a discutir asignaciones; no califican
            productividad ni reemplazan el criterio humano.
          </span>
        </div>
        <ul>
          <li><Check size={13} /> Declaración editable</li>
          <li><Check size={13} /> RLS por workspace</li>
          <li><Check size={13} /> Razones visibles</li>
          <li>Sin presencia, conexión ni velocidad</li>
        </ul>
      </section>
    </div>
  );
}
