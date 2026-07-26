"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Columns3,
  List,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { executionRunStatusLabels } from "@/domain/execution/execution";
import type { ExecutionRunStatus } from "@/infrastructure/supabase/database.types";

import styles from "@/app/app/board/execution-board.module.css";

export type BoardItem = {
  ticketId: string;
  title: string;
  objective: string;
  status: ExecutionRunStatus | "ready";
  progress: number | null;
  guideVersion: number;
  range: string;
  confidence: string;
};

const columns: Array<{
  key: BoardItem["status"];
  label: string;
}> = [
  { key: "ready", label: "Lista" },
  { key: "active", label: "En ejecución" },
  { key: "blocked", label: "Bloqueada" },
  { key: "completed", label: "Completada" },
  { key: "cancelled", label: "Cancelada" },
];

function statusLabel(status: BoardItem["status"]) {
  return status === "ready"
    ? "Lista para iniciar"
    : executionRunStatusLabels[status];
}

export function BoardExplorer({ items }: { items: BoardItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BoardItem["status"] | "all">("all");
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-MX");
    return items.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (!normalized ||
          item.title.toLocaleLowerCase("es-MX").includes(normalized) ||
          item.objective.toLocaleLowerCase("es-MX").includes(normalized)),
    );
  }, [items, query, status]);

  return (
    <section className={styles.explorer}>
      <div className={styles.explorerControls}>
        <label>
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ticket u objetivo"
            aria-label="Buscar en Execution Board"
          />
        </label>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as BoardItem["status"] | "all")
          }
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          {columns.map((column) => (
            <option value={column.key} key={column.key}>{column.label}</option>
          ))}
        </select>
        <div className={styles.viewToggle}>
          <button
            type="button"
            data-active={view === "kanban"}
            aria-pressed={view === "kanban"}
            onClick={() => setView("kanban")}
            aria-label="Vista Kanban"
          >
            <Columns3 size={14} />
          </button>
          <button
            type="button"
            data-active={view === "list"}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            aria-label="Vista de lista"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className={styles.kanban} aria-label="Recorridos agrupados por estado">
          {columns
            .filter(
              (column) =>
                status === "all" ? true : column.key === status,
            )
            .map((column) => {
              const grouped = filtered.filter(
                (item) => item.status === column.key,
              );
              return (
                <div className={styles.kanbanColumn} key={column.key}>
                  <header>
                    <span>{column.label}</span>
                    <strong>{grouped.length}</strong>
                  </header>
                  <div>
                    {grouped.map((item) => (
                      <Link
                        className={styles.boardCard}
                        href={`/app/board/${item.ticketId}`}
                        key={item.ticketId}
                      >
                        <span>
                          {item.status === "completed" ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <CircleDashed size={15} />
                          )}
                          V{String(item.guideVersion).padStart(2, "0")}
                        </span>
                        <strong>{item.title}</strong>
                        <small>{item.objective}</small>
                        <footer>
                          <span>{item.range}</span>
                          <span>{item.progress === null ? "—" : `${item.progress}%`}</span>
                        </footer>
                      </Link>
                    ))}
                    {!grouped.length && <p>Sin recorridos</p>}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className={styles.runList}>
          <header>
            <span>Recorrido</span>
            <span>Estado</span>
            <span>Progreso</span>
            <span>Rango</span>
          </header>
          {filtered.map((item) => (
            <Link href={`/app/board/${item.ticketId}`} key={item.ticketId}>
              <span className={styles.runIcon}>
                {item.status === "completed" ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <CircleDashed size={17} />
                )}
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.objective}</small>
              </div>
              <em data-status={item.status}>{statusLabel(item.status)}</em>
              <b>{item.progress === null ? "—" : `${item.progress}%`}</b>
              <span>{item.range}</span>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
      )}
      {!filtered.length && (
        <div className={styles.empty}>Ningún recorrido coincide con el filtro.</div>
      )}
    </section>
  );
}
