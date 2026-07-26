import type { WorkspaceRole } from "@/infrastructure/supabase/database.types";

export type MemberPlanningProfile = {
  workspaceId: string;
  userId: string;
  availabilityHours: number | null;
  plannedHours: number;
  skills: string[];
  componentExperience: string[];
  technicalOwnership: string[];
  learningGoals: string[];
  updatedAt: string | null;
};

export type CapacityMember = {
  userId: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  activeAssignmentCount: number;
  profile: MemberPlanningProfile | null;
};

export type CapacityLevel =
  | "undeclared"
  | "available"
  | "balanced"
  | "tight"
  | "overloaded";

export function getCapacityPercentage(
  profile: MemberPlanningProfile | null,
) {
  if (!profile?.availabilityHours) return null;
  return Math.round((profile.plannedHours / profile.availabilityHours) * 100);
}

export function getCapacityLevel(
  profile: MemberPlanningProfile | null,
): CapacityLevel {
  const percentage = getCapacityPercentage(profile);
  if (percentage === null) return "undeclared";
  if (percentage > 100) return "overloaded";
  if (percentage > 80) return "tight";
  if (percentage > 45) return "balanced";
  return "available";
}

export const capacityLevelLabels: Record<CapacityLevel, string> = {
  undeclared: "Por declarar",
  available: "Con margen",
  balanced: "Equilibrada",
  tight: "Ajustada",
  overloaded: "Sobrecarga",
};

export function canEditPlanningProfile(
  actorId: string,
  actorRole: WorkspaceRole,
  targetUserId: string,
) {
  return (
    actorId === targetUserId ||
    actorRole === "owner" ||
    actorRole === "admin" ||
    actorRole === "planner"
  );
}

