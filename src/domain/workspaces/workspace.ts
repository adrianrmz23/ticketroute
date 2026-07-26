import type { WorkspaceRole } from "@/infrastructure/supabase/database.types";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  timezone: string;
  estimationUnit: "hours" | "days" | "points";
  weeklyCapacityHours: number;
  defaultAiProvider: "manual" | "openai" | "anthropic" | "gemini";
  dataRetentionDays: 30 | 90 | 180 | 365 | 730;
  deleteAudioAfterTranscription: boolean;
  joinedAt: string;
};

export type WorkspaceMember = {
  userId: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
};

export const workspaceRoleLabels: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  planner: "Planner",
  member: "Member",
  viewer: "Viewer",
};

export const assignableWorkspaceRoles: WorkspaceRole[] = [
  "admin",
  "planner",
  "member",
  "viewer",
];

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canManageRole(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  nextRole: WorkspaceRole,
) {
  if (actorRole === "owner") {
    return true;
  }

  if (actorRole !== "admin") {
    return false;
  }

  return (
    !["owner", "admin"].includes(targetRole) &&
    !["owner", "admin"].includes(nextRole)
  );
}
