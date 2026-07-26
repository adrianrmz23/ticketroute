import {
  ArrowUpRight,
  Check,
  CircleDashed,
  Command,
  CornerDownLeft,
  Route,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import {
  estimateConfidenceLabels,
  estimationUnitLabels,
} from "@/domain/planning/estimate";
import { ticketStatusLabels } from "@/domain/tickets/ticket";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "./command-center.module.css";

const foundationItems = [
  "Tokens visuales",
  "Shell responsive",
  "Navegación accesible",
  "Paleta global",
  "Landing pública",
  "Demo guiada",
  "Clientes Supabase",
  "RLS multiworkspace",
  "Autenticación SSR",
  "Rutas privadas",
  "Workspaces activos",
  "Roles verificables",
  "Invitaciones seguras",
  "Capture Hub persistente",
  "Consentimiento de voz",
  "Organizer explicable",
  "Ticket Studio",
  "Motor por rangos",
  "Planning Lab",
  "Assignment Studio",
  "Escenarios de asignación",
  "Decisiones sin vigilancia",
  "Perfiles de capacidad",
  "Señales declaradas",
  "Ownership y aprendizaje",
  "Planning Guide",
  "Pasos verificables",
  "Fuentes y responsables",
  "Execution Board",
  "Estados declarados",
  "Evidencia y bloqueos",
  "Dependencias y riesgos visibles",
  "Actualización Realtime",
  "Calibration Lab",
  "Aprendizaje confirmado",
  "Adaptadores multiproveedor",
  "Council Mode trazable",
  "Notificaciones por eventos",
  "Integraciones asíncronas",
  "Privacidad y exportación",
  "Auditoría administrativa",
  "Cola con reintentos",
  "Recuperación de errores",
  "Demo de ciclo completo",
];

export default async function CommandCenterPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [
    captureResult,
    ticketResult,
    estimateResult,
    assignmentResult,
    guideResult,
    memberResult,
    capacityResult,
    runResult,
    calibrationResult,
  ] = currentWorkspace
    ? await Promise.all([
        supabase
          .from("capture_sessions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "ready"),
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "ready"),
        supabase
          .from("estimates")
          .select(
            "ticket_id,probable_low,probable_high,unit,confidence,created_at",
          )
          .eq("workspace_id", currentWorkspace.id)
          .eq("is_current", true)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("assignment_plans")
          .select("id,ticket_id,strategy")
          .eq("workspace_id", currentWorkspace.id)
          .eq("is_current", true),
        supabase
          .from("planning_guides")
          .select("id,ticket_id,assignment_plan_id,version")
          .eq("workspace_id", currentWorkspace.id)
          .eq("is_current", true),
        supabase.rpc("get_workspace_members", {
          p_workspace_id: currentWorkspace.id,
        }),
        supabase
          .from("member_planning_profiles")
          .select("availability_hours,planned_hours")
          .eq("workspace_id", currentWorkspace.id),
        supabase
          .from("execution_runs")
          .select("id,ticket_id,status")
          .eq("workspace_id", currentWorkspace.id),
        supabase
          .from("calibration_records")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "confirmed"),
      ])
    : [
        { count: 0 },
        { count: 0 },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { count: 0 },
      ];
  const captureCount = captureResult.count ?? 0;
  const readyTicketCount = ticketResult.count ?? 0;
  const operationEstimates = estimateResult.data ?? [];
  const currentAssignments = assignmentResult.data ?? [];
  const currentGuides = guideResult.data ?? [];
  const declaredCapacity = capacityResult.data ?? [];
  const currentRuns = runResult.data ?? [];
  const calibrationCount = calibrationResult.count ?? 0;
  const declaredAvailability = declaredCapacity.reduce(
    (total, profile) => total + (profile.availability_hours ?? 0),
    0,
  );
  const assignmentByTicket = new Map(
    currentAssignments.map((assignment) => [
      assignment.ticket_id,
      assignment,
    ]),
  );
  const guideByTicket = new Map(
    currentGuides.map((guide) => [guide.ticket_id, guide]),
  );
  const runByTicket = new Map(
    currentRuns.map((run) => [run.ticket_id, run]),
  );
  const { data: assignmentParticipants } = currentAssignments.length
    ? await supabase
        .from("assignment_plan_participants")
        .select("assignment_plan_id,user_id")
        .in(
          "assignment_plan_id",
          currentAssignments.map((assignment) => assignment.id),
        )
        .eq("participation_role", "responsible")
    : { data: [] };
  const displayNameByUserId = new Map(
    (memberResult.data ?? []).map((member) => [
      member.user_id,
      member.display_name,
    ]),
  );
  const responsibleByPlanId = new Map(
    (assignmentParticipants ?? []).map((participant) => [
      participant.assignment_plan_id,
      displayNameByUserId.get(participant.user_id) ?? "Integrante",
    ]),
  );
  const { data: estimatedTickets } = operationEstimates.length
    ? await supabase
        .from("tickets")
        .select("id,title,status")
        .in(
          "id",
          operationEstimates.map((estimate) => estimate.ticket_id),
        )
    : { data: [] };
  const estimatedTicketById = new Map(
    (estimatedTickets ?? []).map((ticket) => [ticket.id, ticket]),
  );
  const metrics = [
    {
      label: "En entrada",
      value: String(captureCount ?? 0).padStart(2, "0"),
      meta: captureCount ? "Listas para organizar" : "Sin solicitudes",
    },
    {
      label: "Listos para planear",
      value: String(readyTicketCount).padStart(2, "0"),
      meta: readyTicketCount ? "Tickets confirmados" : "Base limpia",
    },
    {
      label: "Capacidad declarada",
      value: declaredAvailability ? `${declaredAvailability}h` : "—",
      meta: declaredCapacity.length
        ? `${declaredCapacity.length} perfil(es) configurados`
        : currentWorkspace
          ? `Fallback ${currentWorkspace.weeklyCapacityHours}h por persona`
          : "Sin declaración",
    },
    {
      label: "Aprendizajes confirmados",
      value: String(calibrationCount).padStart(2, "0"),
      meta: calibrationCount
        ? "Resultados contrastados"
        : "Aún sin calibraciones",
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            Workspace en línea
          </p>
          <h1>Command Center</h1>
          <p>
            {currentWorkspace?.name} ya tiene identidad, permisos y capacidad
            base. Las rutas confirmadas ya pueden ejecutarse con estados,
            bloqueos y evidencia visibles, sin vigilar actividad individual.
          </p>
        </div>

        <div className={styles.systemStamp}>
          <span>TR / SYSTEM</span>
          <strong>18</strong>
          <small>Cierre integral</small>
        </div>
      </header>

      <section className={styles.metricsRibbon} aria-label="Resumen operativo">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.meta}</small>
          </div>
        ))}
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.captureSurface}>
          <div className={styles.sectionHeading}>
            <div>
              <span>01 / ENTRADA</span>
              <h2>La ruta comienza con una solicitud.</h2>
            </div>
            <span className={styles.pendingChip}>
              <CircleDashed size={13} aria-hidden="true" />
              Preparado
            </span>
          </div>

          <div className={styles.captureEmpty}>
            <div className={styles.routeSymbol} aria-hidden="true">
              <Route size={29} strokeWidth={1.5} />
            </div>
            <div>
              <strong>Capture Hub ya conserva la intención original</strong>
              <p>
                Texto, dictado, notas y stand-ups comparten borradores
                persistentes, editables y aislados por workspace.
              </p>
            </div>
          </div>

          <Link
            className={styles.inputPreview}
            href="/app/capture"
            aria-label="Abrir Capture Hub"
          >
            <span>Describe el trabajo con tus propias palabras…</span>
            <div>
              <kbd>
                <Command size={11} aria-hidden="true" /> K
              </kbd>
              <span>Comando global disponible</span>
              <span aria-hidden="true">
                <CornerDownLeft size={16} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </section>

        <aside className={styles.foundationPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>BASE / ESTADO</span>
              <h2>Base del producto</h2>
            </div>
            <ShieldCheck size={20} aria-hidden="true" />
          </div>

          <ul>
            {foundationItems.map((item) => (
              <li key={item}>
                <span>
                  <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                </span>
                {item}
                <small>LISTO</small>
              </li>
            ))}
          </ul>

          <div className={styles.foundationNote}>
            <span>Estado del recorrido</span>
            <strong>Entrega integral preparada</strong>
            <p>
              El sistema conserva decisiones, ejecución, evidencia y
              aprendizaje con límites visibles y sin vigilancia individual.
            </p>
          </div>
        </aside>
      </div>

      <section className={styles.operationTable}>
        <div className={styles.tableHeader}>
          <div>
            <span>FLUJO OPERATIVO</span>
            <h2>Trabajo en curso</h2>
          </div>
          <Link href="/app/planning">
            Ver todos
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.tableColumns} aria-hidden="true">
          <span>Ticket</span>
          <span>Estado</span>
          <span>Rango</span>
          <span>Confianza</span>
          <span>Responsable</span>
        </div>

        {operationEstimates.length ? (
          <div className={styles.operationRows}>
            {operationEstimates.map((estimate) => {
              const ticket = estimatedTicketById.get(estimate.ticket_id);
              const assignment = assignmentByTicket.get(estimate.ticket_id);
              const guide = guideByTicket.get(estimate.ticket_id);
              const run = runByTicket.get(estimate.ticket_id);
              if (!ticket) return null;
              return (
                <Link
                  href={
                    run
                      ? `/app/board/${estimate.ticket_id}`
                      : guide
                      ? `/app/planning/${estimate.ticket_id}/guide`
                      : assignment
                      ? `/app/planning/${estimate.ticket_id}/assignment`
                      : `/app/planning/${estimate.ticket_id}`
                  }
                  key={estimate.ticket_id}
                >
                  <strong>{ticket.title}</strong>
                  <span>{ticketStatusLabels[ticket.status]}</span>
                  <span>
                    {estimate.probable_low}–{estimate.probable_high}{" "}
                    {estimationUnitLabels[estimate.unit]}
                  </span>
                  <span>{estimateConfidenceLabels[estimate.confidence]}</span>
                  <span>
                    {assignment
                      ? responsibleByPlanId.get(assignment.id) ?? "Asignado"
                      : "Sin asignar"}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyRow}>
            <span className={styles.emptyIndicator} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <div>
              <strong>Aún no hay estimaciones confirmadas</strong>
              <p>
                Abre Planning Lab desde un ticket y confirma sus tres rangos.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
