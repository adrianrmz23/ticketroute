import { ArrowUpRight, TicketCheck } from "lucide-react";
import Link from "next/link";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import {
  ticketPriorityLabels,
  ticketStatusLabels,
} from "@/domain/tickets/ticket";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "./tickets.module.css";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const { data } = currentWorkspace
    ? await supabase
        .from("tickets")
        .select("id,title,status,priority,labels,updated_at")
        .eq("workspace_id", currentWorkspace.id)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
    : { data: [] };

  return (
    <div className={styles.page}>
      <header>
        <p>TICKETS / CONTROL</p>
        <h1>Tickets</h1>
        <span>Trabajo confirmado desde capturas originales y revisiones trazables.</span>
      </header>
      <section className={styles.list}>
        {data?.length ? (
          data.map((ticket) => (
            <Link href={`/app/tickets/${ticket.id}`} key={ticket.id}>
              <span><TicketCheck size={17} /></span>
              <div>
                <strong>{ticket.title}</strong>
                <small>{ticket.labels.join(" · ") || "Sin etiquetas"}</small>
              </div>
              <em>{ticketPriorityLabels[ticket.priority]}</em>
              <b>{ticketStatusLabels[ticket.status]}</b>
              <ArrowUpRight size={15} />
            </Link>
          ))
        ) : (
          <div className={styles.empty}>
            <TicketCheck size={24} />
            <strong>Todavía no hay tickets confirmados</strong>
            <span>Marca una captura como lista y organízala.</span>
            <Link href="/app/capture">Abrir Capture Hub</Link>
          </div>
        )}
      </section>
    </div>
  );
}
