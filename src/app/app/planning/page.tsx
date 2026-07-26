import {
  ArrowUpRight,
  CircleGauge,
  Scale,
  ShieldQuestion,
} from "lucide-react";
import Link from "next/link";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import {
  estimateConfidenceLabels,
  estimationUnitLabels,
} from "@/domain/planning/estimate";
import {
  ticketPriorityLabels,
  ticketStatusLabels,
} from "@/domain/tickets/ticket";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "./planning.module.css";

export const metadata = { title: "Planning Lab" };

export default async function PlanningPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: tickets }, { data: estimates }] = currentWorkspace
    ? await Promise.all([
        supabase
          .from("tickets")
          .select("id,title,status,priority,unknowns,updated_at")
          .eq("workspace_id", currentWorkspace.id)
          .neq("status", "archived")
          .order("updated_at", { ascending: false }),
        supabase
          .from("estimates")
          .select(
            "ticket_id,version,probable_low,probable_high,unit,confidence,created_at",
          )
          .eq("workspace_id", currentWorkspace.id)
          .eq("is_current", true),
      ])
    : [{ data: [] }, { data: [] }];
  const currentByTicket = new Map(
    (estimates ?? []).map((estimate) => [estimate.ticket_id, estimate]),
  );

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p><span aria-hidden="true" /> PLANEACIÓN / ESCENARIOS</p>
          <h1>Planning Lab</h1>
          <span>
            Convierte tickets estructurados en rangos discutibles, editables y
            trazables.
          </span>
        </div>
        <div className={styles.labStamp}>
          <CircleGauge size={19} />
          <span>
            <strong>{String(tickets?.length ?? 0).padStart(2, "0")}</strong>
            Tickets visibles
          </span>
        </div>
      </header>

      <section className={styles.principle}>
        <Scale size={22} />
        <div>
          <strong>Una estimación es una conversación con límites.</strong>
          <p>
            TicketRoute combina complejidad, riesgo, dependencias, capacidad y
            evidencia; el usuario conserva el criterio final.
          </p>
        </div>
        <span>FAVORABLE · PROBABLE · ADVERSO</span>
      </section>

      <section className={styles.ticketList}>
        <header>
          <span>Tickets disponibles</span>
          <span>Rango probable</span>
          <span>Confianza</span>
          <span>Estado</span>
        </header>
        {tickets?.length ? (
          tickets.map((ticket) => {
            const estimate = currentByTicket.get(ticket.id);
            return (
              <Link href={`/app/planning/${ticket.id}`} key={ticket.id}>
                <span className={styles.ticketIcon}>
                  {estimate ? <Scale size={16} /> : <ShieldQuestion size={16} />}
                </span>
                <div>
                  <strong>{ticket.title}</strong>
                  <small>
                    {ticketPriorityLabels[ticket.priority]} ·{" "}
                    {ticket.unknowns.length
                      ? `${ticket.unknowns.length} incógnita(s)`
                      : "Contexto suficiente"}
                  </small>
                </div>
                <b>
                  {estimate
                    ? `${estimate.probable_low}–${estimate.probable_high} ${
                        estimationUnitLabels[estimate.unit]
                      }`
                    : "Por calcular"}
                </b>
                <em data-confidence={estimate?.confidence ?? "pending"}>
                  {estimate
                    ? estimateConfidenceLabels[estimate.confidence]
                    : "Pendiente"}
                </em>
                <span>{ticketStatusLabels[ticket.status]}</span>
                <ArrowUpRight size={15} />
              </Link>
            );
          })
        ) : (
          <div className={styles.empty}>
            <Scale size={24} />
            <strong>No hay tickets para estimar</strong>
            <span>Organiza una captura y confirma el ticket primero.</span>
            <Link href="/app/capture">Abrir Capture Hub</Link>
          </div>
        )}
      </section>
    </div>
  );
}

