import type { EstimationUnit } from "@/domain/planning/estimate";

export const guidePhases = [
  "prepare",
  "build",
  "integrate",
  "verify",
  "handoff",
] as const;

export const guideSourceKinds = [
  "ticket",
  "unknown",
  "dependency",
  "subtask",
  "requirement",
  "criterion",
  "outcome",
  "manual",
] as const;

export type GuidePhase = (typeof guidePhases)[number];
export type GuideSourceKind = (typeof guideSourceKinds)[number];

export type GuideCandidate = {
  userId: string;
  displayName: string;
  participationRole: "responsible" | "collaborator";
  contributionPercent: number;
};

export type PlanningGuideStep = {
  localId: string;
  position: number;
  phase: GuidePhase;
  title: string;
  outcome: string;
  responsibleUserId: string;
  responsibleName: string;
  effortShare: number;
  verification: string;
  dependencies: string[];
  risks: string[];
  sourceKind: GuideSourceKind;
  sourceLabel: string;
};

export type PlanningGuide = {
  ticketId: string;
  estimateId: string;
  assignmentPlanId: string;
  objective: string;
  sequenceRationale: string;
  verificationStrategy: string;
  estimateRange: {
    low: number;
    high: number;
    unit: EstimationUnit;
  };
  steps: PlanningGuideStep[];
  assumptions: string[];
  evidenceLimitations: string[];
  engineKind: "local_rules";
  engineVersion: "tr-guide-1";
};

export const guidePhaseLabels: Record<GuidePhase, string> = {
  prepare: "Preparar",
  build: "Construir",
  integrate: "Integrar",
  verify: "Verificar",
  handoff: "Entregar",
};

export const guideSourceLabels: Record<GuideSourceKind, string> = {
  ticket: "Ticket",
  unknown: "Incógnita",
  dependency: "Dependencia",
  subtask: "Subtarea",
  requirement: "Requisito",
  criterion: "Criterio",
  outcome: "Resultado",
  manual: "Criterio humano",
};

