export const estimationUnits = ["hours", "days", "points"] as const;
export const estimateConfidences = ["low", "medium", "high"] as const;
export const estimateFactorDirections = [
  "increases",
  "decreases",
  "neutral",
] as const;

export type EstimationUnit = (typeof estimationUnits)[number];
export type EstimateConfidence = (typeof estimateConfidences)[number];
export type EstimateFactorDirection =
  (typeof estimateFactorDirections)[number];

export type EstimateRange = {
  low: number;
  high: number;
};

export type EstimateScenario = EstimateRange & {
  key: "favorable" | "probable" | "adverse";
  label: string;
  explanation: string;
};

export type EstimateFactor = {
  key: string;
  label: string;
  direction: EstimateFactorDirection;
  weight: 1 | 2 | 3;
  evidence: string;
};

export type EstimateBreakdownItem = {
  label: string;
  effortShare: number;
  basis: string;
};

export type EstimateProposal = {
  unit: EstimationUnit;
  scenarios: {
    favorable: EstimateScenario;
    probable: EstimateScenario;
    adverse: EstimateScenario;
  };
  confidence: EstimateConfidence;
  basis: string;
  decomposition: EstimateBreakdownItem[];
  assumptions: string[];
  unknowns: string[];
  risks: string[];
  dependencies: string[];
  historicalReferences: string[];
  factors: EstimateFactor[];
  calculationSnapshot: {
    complexityScore: number;
    capacityHoursPerWeek: number;
    comparableCount: number;
  };
  engineKind: "local_rules";
  engineVersion: "tr-estimate-1";
};

export const estimationUnitLabels: Record<EstimationUnit, string> = {
  hours: "horas",
  days: "días",
  points: "puntos",
};

export const estimateConfidenceLabels: Record<EstimateConfidence, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const estimateFactorDirectionLabels: Record<
  EstimateFactorDirection,
  string
> = {
  increases: "Amplía",
  decreases: "Reduce",
  neutral: "Contexto",
};

