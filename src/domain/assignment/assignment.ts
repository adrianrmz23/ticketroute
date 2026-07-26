import type { EstimateConfidence, EstimationUnit } from "@/domain/planning/estimate";
import type { WorkspaceRole } from "@/infrastructure/supabase/database.types";

export const assignmentStrategies = [
  "fast_delivery",
  "balanced_load",
  "knowledge_transfer",
  "custom",
] as const;

export const assignmentLoadLevels = [
  "low",
  "medium",
  "high",
  "overloaded",
] as const;

export const knowledgeConcentrations = ["low", "medium", "high"] as const;

export type AssignmentStrategy = (typeof assignmentStrategies)[number];
export type AssignmentLoadLevel = (typeof assignmentLoadLevels)[number];
export type KnowledgeConcentration =
  (typeof knowledgeConcentrations)[number];

export type AssignmentCandidate = {
  userId: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
  activeAssignmentCount: number;
  priorParticipation: boolean;
  planningProfile?: {
    availabilityHours: number | null;
    plannedHours: number;
    skills: string[];
    componentExperience: string[];
    technicalOwnership: string[];
    learningGoals: string[];
  } | null;
};

export type AssignmentParticipant = {
  userId: string;
  displayName: string;
  participationRole: "responsible" | "collaborator";
  contributionPercent: number;
  reason: string;
};

export type AssignmentLoad = {
  level: AssignmentLoadLevel;
  percentage: number | null;
  label: string;
  basis: string;
};

export type AssignmentEvidence = {
  signal: string;
  status: "used" | "missing" | "excluded";
  detail: string;
};

export type AssignmentScenario = {
  strategy: AssignmentStrategy;
  label: string;
  summary: string;
  estimateId: string;
  range: {
    low: number;
    high: number;
    unit: EstimationUnit;
  };
  confidence: EstimateConfidence;
  participants: AssignmentParticipant[];
  resultingLoad: AssignmentLoad;
  knowledgeConcentration: KnowledgeConcentration;
  rationale: string;
  risks: string[];
  discardedAlternatives: string[];
  changeConsequence: string;
  evidence: AssignmentEvidence[];
  evidenceLimitations: string[];
  engineKind: "local_rules";
  engineVersion: "tr-assignment-2";
};

export const assignmentStrategyLabels: Record<AssignmentStrategy, string> = {
  fast_delivery: "Entrega rápida",
  balanced_load: "Carga equilibrada",
  knowledge_transfer: "Transferencia de conocimiento",
  custom: "Personalizado",
};

export const assignmentLoadLabels: Record<AssignmentLoadLevel, string> = {
  low: "Ligera",
  medium: "Moderada",
  high: "Alta",
  overloaded: "Sobrecarga",
};

export const knowledgeConcentrationLabels: Record<
  KnowledgeConcentration,
  string
> = {
  low: "Distribuido",
  medium: "Compartido",
  high: "Concentrado",
};
