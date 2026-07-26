import { ClipboardList, ShieldCheck } from "lucide-react";

import { calculateExecutionProgress } from "@/application/execution/calculate-execution-progress";
import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import {
  BoardExplorer,
  type BoardItem,
} from "@/features/execution/components/board-explorer";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "./execution-board.module.css";

export const metadata = { title: "Execution Board" };

export default async function ExecutionBoardPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();

  const [
    { data: guides, error: guidesError },
    { data: runs, error: runsError },
  ] = currentWorkspace
    ? await Promise.all([
        supabase
          .from("planning_guides")
          .select("id,ticket_id,assignment_plan_id,version,objective,created_at")
          .eq("workspace_id", currentWorkspace.id)
          .eq("is_current", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("execution_runs")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .order("updated_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  if (guidesError || runsError) {
    throw new Error(
      "No se pudo cargar Execution Board. Ejecuta la migración del Bloque 12.",
    );
  }

  const ticketIds = (guides ?? []).map((guide) => guide.ticket_id);
  const runIds = (runs ?? []).map((run) => run.id);
  const assignmentIds = (guides ?? []).map(
    (guide) => guide.assignment_plan_id,
  );
  const [{ data: tickets }, { data: steps }, { data: assignments }] =
    await Promise.all([
    ticketIds.length
      ? supabase
          .from("tickets")
          .select("id,title,status")
          .in("id", ticketIds)
      : Promise.resolve({ data: [] }),
    runIds.length
      ? supabase
          .from("execution_steps")
          .select("execution_run_id,status,effort_share")
          .in("execution_run_id", runIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length
      ? supabase
          .from("assignment_plans")
          .select("id,range_low,range_high,unit,confidence")
          .in("id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ticketById = new Map(
    (tickets ?? []).map((ticket) => [ticket.id, ticket]),
  );
  const runByGuide = new Map(
    (runs ?? []).map((run) => [run.planning_guide_id, run]),
  );
  const assignmentById = new Map(
    (assignments ?? []).map((assignment) => [assignment.id, assignment]),
  );
  const stepsByRun = new Map<
    string,
    {
      execution_run_id: string;
      status: "pending" | "in_progress" | "blocked" | "done" | "skipped";
      effort_share: number;
    }[]
  >();
  for (const step of steps ?? []) {
    const current = stepsByRun.get(step.execution_run_id) ?? [];
    current.push(step);
    stepsByRun.set(step.execution_run_id, current);
  }

  const activeCount = (runs ?? []).filter((run) =>
    ["active", "blocked"].includes(run.status),
  ).length;
  const completedCount = (runs ?? []).filter(
    (run) => run.status === "completed",
  ).length;
  const boardItems: BoardItem[] = (guides ?? []).map((guide) => {
    const ticket = ticketById.get(guide.ticket_id);
    const run = runByGuide.get(guide.id);
    const progress = run
      ? calculateExecutionProgress(
          (stepsByRun.get(run.id) ?? []).map((step) => ({
            effortShare: step.effort_share,
            status: step.status,
          })),
        )
      : null;
    const assignment = assignmentById.get(guide.assignment_plan_id);
    return {
      ticketId: guide.ticket_id,
      title: ticket?.title ?? "Ticket verificable",
      objective: guide.objective,
      status: run?.status ?? "ready",
      progress: progress?.percentage ?? null,
      guideVersion: guide.version,
      range: assignment
        ? `${assignment.range_low}–${assignment.range_high} ${assignment.unit}`
        : "—",
      confidence: assignment?.confidence ?? "—",
    };
  });

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p><span aria-hidden="true" /> OPERACIÓN / RECORRIDOS</p>
          <h1>Ejecutar con evidencia, no con vigilancia.</h1>
          <span>
            Cada estado lo declara una persona autorizada. La guía original
            permanece intacta y las razones siguen visibles.
          </span>
        </div>
        <div className={styles.boardStamp}>
          <ClipboardList size={19} />
          <span>
            <strong>12</strong>
            Estados explícitos
          </span>
        </div>
      </header>

      <section className={styles.metrics}>
        <div>
          <span>Guías disponibles</span>
          <strong>{String(guides?.length ?? 0).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Recorridos abiertos</span>
          <strong>{String(activeCount).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Recorridos cerrados</span>
          <strong>{String(completedCount).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Telemetría individual</span>
          <strong>NO</strong>
        </div>
      </section>

      <section className={styles.principle}>
        <ShieldCheck size={21} />
        <div>
          <strong>El avance es una declaración verificable.</strong>
          <p>
            TicketRoute registra transiciones, evidencia y bloqueos; no
            presencia, velocidad de escritura ni actividad oculta.
          </p>
        </div>
        <span>PENDIENTE · EN CURSO · BLOQUEADO · RESUELTO</span>
      </section>

      <BoardExplorer items={boardItems} />
    </div>
  );
}
