import { describe, expect, it } from "vitest";

import type { AssignmentCandidate } from "@/domain/assignment/assignment";

import { generateAssignmentScenarios } from "./generate-assignment-scenarios";

const candidates: AssignmentCandidate[] = [
  {
    userId: "10000000-0000-4000-8000-000000000001",
    displayName: "Adrián",
    role: "owner",
    joinedAt: "2026-07-01T00:00:00Z",
    activeAssignmentCount: 1,
    priorParticipation: true,
  },
  {
    userId: "10000000-0000-4000-8000-000000000002",
    displayName: "Sofía",
    role: "planner",
    joinedAt: "2026-07-02T00:00:00Z",
    activeAssignmentCount: 0,
    priorParticipation: false,
  },
];

const estimate = {
  id: "20000000-0000-4000-8000-000000000001",
  unit: "days" as const,
  confidence: "medium" as const,
  favorable: { low: 2, high: 3 },
  probable: { low: 3, high: 5 },
  adverse: { low: 5, high: 7 },
};

describe("generateAssignmentScenarios", () => {
  it("genera cuatro estrategias comparables y trazables", () => {
    const scenarios = generateAssignmentScenarios({
      estimate,
      candidates,
      weeklyCapacityHours: 40,
      dependencies: ["Proveedor Shopify"],
    });

    expect(scenarios.map((scenario) => scenario.strategy)).toEqual([
      "fast_delivery",
      "balanced_load",
      "knowledge_transfer",
      "custom",
    ]);
    expect(
      scenarios.every((scenario) => scenario.range.low < scenario.range.high),
    ).toBe(true);
    expect(
      scenarios.every(
        (scenario) =>
          scenario.participants.reduce(
            (total, participant) =>
              total + participant.contributionPercent,
            0,
          ) === 100,
      ),
    ).toBe(true);
  });

  it("prioriza continuidad para velocidad y menor carga para equilibrio", () => {
    const scenarios = generateAssignmentScenarios({
      estimate,
      candidates,
      weeklyCapacityHours: 40,
      dependencies: [],
    });
    const fast = scenarios[0];
    const balanced = scenarios[1];

    expect(fast.participants[0].displayName).toBe("Adrián");
    expect(balanced.participants[0].displayName).toBe("Sofía");
  });

  it("excluye viewers y cualquier señal de vigilancia", () => {
    const scenarios = generateAssignmentScenarios({
      estimate,
      candidates: [
        ...candidates,
        {
          userId: "10000000-0000-4000-8000-000000000003",
          displayName: "Observador",
          role: "viewer",
          joinedAt: "2026-07-03T00:00:00Z",
          activeAssignmentCount: 0,
          priorParticipation: false,
        },
      ],
      weeklyCapacityHours: 40,
      dependencies: [],
    });

    expect(
      scenarios.flatMap((scenario) =>
        scenario.participants.map((participant) => participant.displayName),
      ),
    ).not.toContain("Observador");
    expect(
      scenarios[0].evidence.find(
        (item) => item.signal === "Actividad individual",
      )?.status,
    ).toBe("excluded");
  });

  it("usa capacidad y conocimiento declarados con una razón visible", () => {
    const scenarios = generateAssignmentScenarios({
      estimate,
      candidates: [
        {
          ...candidates[0],
          activeAssignmentCount: 0,
          priorParticipation: false,
          planningProfile: {
            availabilityHours: 20,
            plannedHours: 18,
            skills: ["Diseño"],
            componentExperience: [],
            technicalOwnership: [],
            learningGoals: [],
          },
        },
        {
          ...candidates[1],
          planningProfile: {
            availabilityHours: 40,
            plannedHours: 8,
            skills: ["React"],
            componentExperience: ["Checkout"],
            technicalOwnership: ["Frontend"],
            learningGoals: ["PostgreSQL"],
          },
        },
      ],
      weeklyCapacityHours: 40,
      dependencies: [],
      workSignals: ["Implementar checkout con React"],
    });
    const balanced = scenarios.find(
      (scenario) => scenario.strategy === "balanced_load",
    )!;

    expect(balanced.participants[0].displayName).toBe("Sofía");
    expect(balanced.participants[0].reason).toContain("8h de 40h");
    expect(balanced.resultingLoad.basis).toContain("40h declaradas");
    expect(
      balanced.evidence.find(
        (item) => item.signal === "Habilidades y ownership",
      )?.status,
    ).toBe("used");
  });
});
