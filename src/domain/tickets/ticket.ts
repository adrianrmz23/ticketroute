export const ticketStatuses = [
  "draft",
  "needs_context",
  "ready",
  "planned",
  "in_progress",
  "review",
  "blocked",
  "done",
  "archived",
] as const;

export const ticketPriorities = ["low", "medium", "high", "urgent"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];

export type TicketDraft = {
  title: string;
  objective: string;
  problem: string;
  context: string;
  expectedOutcome: string;
  scope: string[];
  outOfScope: string[];
  functionalRequirements: string[];
  technicalRequirements: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  risks: string[];
  assumptions: string[];
  unknowns: string[];
  dependencies: string[];
  labels: string[];
  priority: TicketPriority;
  targetDate: string;
  subtasks: string[];
  status: TicketStatus;
};

export type TicketSummary = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  labels: string[];
  updatedAt: string;
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  draft: "Borrador",
  needs_context: "Necesita contexto",
  ready: "Listo para planear",
  planned: "Planeado",
  in_progress: "En progreso",
  review: "En revisión",
  blocked: "Bloqueado",
  done: "Terminado",
  archived: "Archivado",
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};
