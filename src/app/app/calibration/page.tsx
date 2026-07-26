import { ArrowUpRight, History, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/app/app/operations.module.css";

export const metadata = { title: "Calibration Lab" };

export default async function CalibrationPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();

  const [{ data: runs, error: runsError }, { data: records, error: recordsError }] =
    currentWorkspace
      ? await Promise.all([
          supabase
            .from("execution_runs")
            .select("id,ticket_id,completed_at")
            .eq("workspace_id", currentWorkspace.id)
            .eq("status", "completed")
            .order("completed_at", { ascending: false }),
          supabase
            .from("calibration_records")
            .select("ticket_id,status,selected_scenario,actual_value,unit")
            .eq("workspace_id", currentWorkspace.id),
        ])
      : [{ data: [] }, { data: [] }];

  if (runsError || recordsError) {
    throw new Error(
      "No se pudo abrir Calibration Lab. Ejecuta la migración 0010.",
    );
  }

  const ticketIds = (runs ?? []).map((run) => run.ticket_id);
  const { data: tickets } = ticketIds.length
    ? await supabase
        .from("tickets")
        .select("id,title,objective")
        .in("id", ticketIds)
    : { data: [] };
  const ticketById = new Map((tickets ?? []).map((item) => [item.id, item]));
  const recordByTicket = new Map(
    (records ?? []).map((record) => [record.ticket_id, record]),
  );
  const confirmed = (records ?? []).filter(
    (record) => record.status === "confirmed",
  ).length;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PLANEACIÓN / APRENDIZAJE</p>
          <h1>Aprender del resultado sin calificar personas.</h1>
          <p className={styles.heroText}>
            Compara el rango confirmado con el recorrido real, conserva
            cambios de alcance y convierte desviaciones en referencias
            verificables para futuros tickets.
          </p>
        </div>
        <div className={styles.stamp}>
          <SlidersHorizontal size={20} />
          <span>
            <strong>{String(confirmed).padStart(2, "0")}</strong>
            Referencias
          </span>
        </div>
      </header>

      <section className={styles.metrics}>
        <div><span>Recorridos cerrados</span><strong>{runs?.length ?? 0}</strong></div>
        <div><span>Calibraciones</span><strong>{records?.length ?? 0}</strong></div>
        <div><span>Confirmadas</span><strong>{confirmed}</strong></div>
        <div><span>Ranking individual</span><strong>NO</strong></div>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <p>01 / ELEGIBLES</p>
            <h2>Trabajo listo para calibrar</h2>
          </div>
          <span>Solo recorridos completados</span>
        </header>
        <div className={styles.list}>
          {runs?.length ? (
            runs.map((run) => {
              const ticket = ticketById.get(run.ticket_id);
              const record = recordByTicket.get(run.ticket_id);
              return (
                <Link
                  className={styles.listItem}
                  href={`/app/calibration/${run.ticket_id}`}
                  key={run.id}
                >
                  <History size={17} />
                  <div>
                    <strong>{ticket?.title ?? "Ticket completado"}</strong>
                    <small>
                      {record
                        ? `${record.status === "confirmed" ? "Confirmada" : "Borrador"} · ${record.actual_value} ${record.unit}`
                        : "Pendiente de comparación"}
                    </small>
                  </div>
                  <ArrowUpRight size={15} />
                </Link>
              );
            })
          ) : (
            <div className={styles.empty}>
              <History size={24} />
              <strong>Aún no hay recorridos completados</strong>
              <span>Completa una ejecución para habilitar su calibración.</span>
              <Link className={styles.secondaryButton} href="/app/board">
                Abrir Execution Board
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
