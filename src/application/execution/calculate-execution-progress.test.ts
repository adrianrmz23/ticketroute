import { describe, expect, it } from "vitest";

import { calculateExecutionProgress } from "./calculate-execution-progress";

describe("calculateExecutionProgress", () => {
  it("calcula avance ponderado por el esfuerzo confirmado", () => {
    const progress = calculateExecutionProgress([
      { effortShare: 20, status: "done" },
      { effortShare: 55, status: "in_progress" },
      { effortShare: 25, status: "pending" },
    ]);

    expect(progress.percentage).toBe(20);
    expect(progress.activeCount).toBe(1);
    expect(progress.runStatus).toBe("active");
  });

  it("hace visible un bloqueo sin inventar avance", () => {
    const progress = calculateExecutionProgress([
      { effortShare: 60, status: "blocked" },
      { effortShare: 40, status: "pending" },
    ]);

    expect(progress.percentage).toBe(0);
    expect(progress.blockedCount).toBe(1);
    expect(progress.runStatus).toBe("blocked");
  });

  it("considera resueltos los pasos completados u omitidos con razón", () => {
    const progress = calculateExecutionProgress([
      { effortShare: 80, status: "done" },
      { effortShare: 20, status: "skipped" },
    ]);

    expect(progress.percentage).toBe(100);
    expect(progress.resolvedCount).toBe(2);
    expect(progress.runStatus).toBe("completed");
  });
});
