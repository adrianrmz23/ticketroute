import type {
  GuidePhase,
  GuideSourceKind,
} from "@/domain/guides/planning-guide";

export const executionRunStatuses = [
  "active",
  "blocked",
  "completed",
  "cancelled",
] as const;

export const executionStepStatuses = [
  "pending",
  "in_progress",
  "blocked",
  "done",
  "skipped",
] as const;

export type ExecutionRunStatus = (typeof executionRunStatuses)[number];
export type ExecutionStepStatus = (typeof executionStepStatuses)[number];

export type ExecutionStep = {
  id: string;
  guideStepId: string;
  position: number;
  phase: GuidePhase;
  title: string;
  outcome: string;
  responsibleUserId: string;
  responsibleName: string;
  effortShare: number;
  verification: string;
  sourceKind: GuideSourceKind;
  sourceLabel: string;
  dependencies: string[];
  risks: string[];
  status: ExecutionStepStatus;
  evidenceNote: string;
  blockerNote: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type ExecutionRun = {
  id: string;
  ticketId: string;
  guideId: string;
  guideVersion: number;
  status: ExecutionRunStatus;
  startedAt: string;
  completedAt: string | null;
  steps: ExecutionStep[];
};

export const executionRunStatusLabels: Record<ExecutionRunStatus, string> = {
  active: "En ejecución",
  blocked: "Con bloqueos",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const executionStepStatusLabels: Record<ExecutionStepStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  blocked: "Bloqueado",
  done: "Completado",
  skipped: "Omitido",
};
