import { describe, expect, it } from "vitest";

import {
  canEditPlanningProfile,
  getCapacityLevel,
  getCapacityPercentage,
  type MemberPlanningProfile,
} from "./capacity";

const profile: MemberPlanningProfile = {
  workspaceId: "10000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  availabilityHours: 40,
  plannedHours: 32,
  skills: ["React"],
  componentExperience: ["Checkout"],
  technicalOwnership: ["Frontend"],
  learningGoals: ["PostgreSQL"],
  updatedAt: "2026-07-26T00:00:00Z",
};

describe("capacity", () => {
  it("expone el porcentaje únicamente con disponibilidad declarada", () => {
    expect(getCapacityPercentage(profile)).toBe(80);
    expect(getCapacityPercentage({ ...profile, availabilityHours: null })).toBe(
      null,
    );
  });

  it("clasifica la capacidad sin convertirla en un puntaje personal", () => {
    expect(getCapacityLevel(profile)).toBe("balanced");
    expect(getCapacityLevel({ ...profile, plannedHours: 41 })).toBe(
      "overloaded",
    );
    expect(getCapacityLevel(null)).toBe("undeclared");
  });

  it("permite autodeclaración y administración operativa", () => {
    expect(canEditPlanningProfile(profile.userId, "member", profile.userId)).toBe(
      true,
    );
    expect(
      canEditPlanningProfile(
        "30000000-0000-4000-8000-000000000001",
        "planner",
        profile.userId,
      ),
    ).toBe(true);
    expect(
      canEditPlanningProfile(
        "30000000-0000-4000-8000-000000000001",
        "viewer",
        profile.userId,
      ),
    ).toBe(false);
  });
});

