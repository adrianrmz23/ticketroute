import { History, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { estimationUnitLabels } from "@/domain/planning/estimate";
import { CalibrationForm } from "@/features/calibration/components/calibration-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Calibrar resultado" };

export default async function CalibrationTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) notFound();
  const supabase = await createSupabaseServerClient();

  const [{ data: ticket }, { data: run }, { data: record, error: recordError }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("id,title,objective")
        .eq("workspace_id", currentWorkspace.id)
        .eq("id", ticketId)
        .maybeSingle(),
      supabase
        .from("execution_runs")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("ticket_id", ticketId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("calibration_records")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("ticket_id", ticketId)
        .maybeSingle(),
    ]);

  if (!ticket || !run) notFound();
  if (recordError) {
    throw new Error("No se pudo cargar el registro de calibración.");
  }

  const { data: guide } = await supabase
    .from("planning_guides")
    .select("assignment_plan_id")
    .eq("id", run.planning_guide_id)
    .maybeSingle();
  const { data: assignment } = guide
    ? await supabase
        .from("assignment_plans")
        .select("range_low,range_high,unit")
        .eq("id", guide.assignment_plan_id)
        .maybeSingle()
    : { data: null };
  if (!assignment) notFound();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>CALIBRATION LAB / RESULTADO</p>
          <h1>Convertir una desviación en una referencia.</h1>
          <p className={styles.heroText}>
            {ticket.title} · El resultado se compara con la decisión
            confirmada, nunca con actividad oculta de sus responsables.
          </p>
        </div>
        <div className={styles.stamp}>
          <History size={20} />
          <span>
            <strong>{record?.status === "confirmed" ? "OK" : "01"}</strong>
            {record?.status === "confirmed" ? "Confirmada" : "Revisión"}
          </span>
        </div>
      </header>

      <div className={styles.split}>
        <CalibrationForm
          ticketId={ticket.id}
          estimatedLow={assignment.range_low}
          estimatedHigh={assignment.range_high}
          unitLabel={estimationUnitLabels[assignment.unit]}
          record={
            record
              ? {
                  status: record.status,
                  actualValue: record.actual_value,
                  interruptionCount: record.interruption_count,
                  scopeChanged: record.scope_changed,
                  unexpectedBlockers: record.unexpected_blockers,
                  unexpectedDependencies: record.unexpected_dependencies,
                  deviationCause: record.deviation_cause,
                  selectedScenario: record.selected_scenario,
                  learningSummary: record.learning_summary,
                }
              : null
          }
        />
        <aside className={styles.darkCard}>
          <p className={styles.sectionLabel}>02 / FRONTERA</p>
          <h2>Aprendizaje sin vigilancia</h2>
          <div className={styles.darkList}>
            <div><ShieldCheck size={15} /><span><strong>Fuente visible</strong><small>Rango, guía y ejecución permanecen enlazados.</small></span></div>
            <div><ShieldCheck size={15} /><span><strong>Contexto antes que culpa</strong><small>Alcance, bloqueos y dependencias explican la desviación.</small></span></div>
            <div><ShieldCheck size={15} /><span><strong>Referencia, no puntuación</strong><small>No se publica un ranking de personas.</small></span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
