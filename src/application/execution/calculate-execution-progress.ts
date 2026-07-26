import type {
  ExecutionRunStatus,
  ExecutionStepStatus,
} from "@/domain/execution/execution";

type ProgressStep = {
  effortShare: number;
  status: ExecutionStepStatus;
};

export type ExecutionProgress = {
  percentage: number;
  resolvedCount: number;
  blockedCount: number;
  activeCount: number;
  pendingCount: number;
  runStatus: ExecutionRunStatus;
};

export function calculateExecutionProgress(
  steps: ProgressStep[],
): ExecutionProgress {
  const resolved = steps.filter(
    (step) => step.status === "done" || step.status === "skipped",
  );
  const blockedCount = steps.filter(
    (step) => step.status === "blocked",
  ).length;
  const activeCount = steps.filter(
    (step) => step.status === "in_progress",
  ).length;
  const pendingCount = steps.filter(
    (step) => step.status === "pending",
  ).length;
  const percentage = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        resolved.reduce((total, step) => total + step.effortShare, 0),
      ),
    ),
  );

  return {
    percentage,
    resolvedCount: resolved.length,
    blockedCount,
    activeCount,
    pendingCount,
    runStatus:
      steps.length > 0 && resolved.length === steps.length
        ? "completed"
        : blockedCount > 0
          ? "blocked"
          : "active",
  };
}
