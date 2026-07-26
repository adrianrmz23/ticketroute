"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_WORKSPACE_COOKIE } from "@/application/workspaces/get-workspace-context";
import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";
import {
  changeMemberRoleSchema,
  createInviteSchema,
  createWorkspaceSchema,
  invitationTokenSchema,
  removeMemberSchema,
  revokeInviteSchema,
  selectWorkspaceSchema,
} from "@/domain/workspaces/workspace-schemas";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { getSiteUrl } from "@/infrastructure/supabase/site-url";

import type { WorkspaceActionState } from "./workspace-state";

function validationError(
  fieldErrors: Record<string, string[] | undefined>,
): WorkspaceActionState {
  return {
    status: "error",
    message: "Revisa los campos marcados.",
    fieldErrors,
  };
}

function workspaceError(message: string): WorkspaceActionState {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("duplicate key") ||
    normalized.includes("workspaces_slug_key")
  ) {
    return {
      status: "error",
      message: "Esa URL de workspace ya está ocupada. Prueba otra.",
      fieldErrors: { slug: ["La URL ya está en uso"] },
    };
  }

  if (normalized.includes("already a workspace member")) {
    return {
      status: "error",
      message: "Ese correo ya pertenece al workspace.",
    };
  }

  if (
    normalized.includes("administration required") ||
    normalized.includes("access denied") ||
    normalized.includes("privileged roles")
  ) {
    return {
      status: "error",
      message: "Tu rol no permite realizar esta operación.",
    };
  }

  if (
    normalized.includes("last owner") ||
    normalized.includes("keep at least one owner")
  ) {
    return {
      status: "error",
      message: "El workspace debe conservar al menos un Owner.",
    };
  }

  return {
    status: "error",
    message: "No pudimos completar la operación. Inténtalo nuevamente.",
  };
}

async function requireAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return { supabase, user };
}

async function setActiveWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createWorkspaceAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
    estimationUnit: formData.get("estimationUnit"),
    weeklyCapacityHours: formData.get("weeklyCapacityHours"),
    defaultAiProvider: formData.get("defaultAiProvider"),
    dataRetentionDays: formData.get("dataRetentionDays"),
    deleteAudioAfterTranscription:
      formData.get("deleteAudioAfterTranscription") === "on",
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase } = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc("create_workspace_v2", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
    p_estimation_unit: parsed.data.estimationUnit,
    p_weekly_capacity_hours: parsed.data.weeklyCapacityHours,
    p_default_ai_provider: parsed.data.defaultAiProvider,
    p_data_retention_days: parsed.data.dataRetentionDays,
    p_delete_audio_after_transcription:
      parsed.data.deleteAudioAfterTranscription,
  });

  if (error || !data) {
    return workspaceError(error?.message ?? "Workspace creation failed");
  }

  await setActiveWorkspace(data);
  revalidatePath("/", "layout");
  redirect("/app");
}

export async function selectWorkspaceAction(formData: FormData) {
  const parsed = selectWorkspaceSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
  });

  if (!parsed.success) {
    return;
  }

  const { supabase } = await requireAuthenticatedClient();
  const { data } = await supabase.rpc("get_my_workspaces");
  const isMember = data?.some(
    (workspace) => workspace.id === parsed.data.workspaceId,
  );

  if (!isMember) {
    return;
  }

  await setActiveWorkspace(parsed.data.workspaceId);
  revalidatePath("/app", "layout");
  redirect(
    getSafeRedirectPath(String(formData.get("returnTo") ?? "/app")),
  );
}

export async function createInviteAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = createInviteSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase } = await requireAuthenticatedClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await supabase.rpc("create_workspace_invite", {
    p_workspace_id: parsed.data.workspaceId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (error) {
    return workspaceError(error.message);
  }

  revalidatePath("/app/team");

  return {
    status: "success",
    message:
      "Invitación preparada. Comparte el enlace por un canal autorizado.",
    inviteUrl: `${getSiteUrl()}/invite/${token}`,
  };
}

export async function revokeInviteAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = revokeInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase } = await requireAuthenticatedClient();
  const { error } = await supabase.rpc("revoke_workspace_invite", {
    p_invite_id: parsed.data.inviteId,
  });

  if (error) {
    return workspaceError(error.message);
  }

  revalidatePath("/app/team");
  return { status: "success", message: "Invitación revocada." };
}

export async function changeMemberRoleAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = changeMemberRoleSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase } = await requireAuthenticatedClient();
  const { error } = await supabase.rpc("change_workspace_member_role", {
    p_workspace_id: parsed.data.workspaceId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) {
    return workspaceError(error.message);
  }

  revalidatePath("/app/team");
  revalidatePath("/app", "layout");
  return { status: "success", message: "Rol actualizado." };
}

export async function removeMemberAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = removeMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await requireAuthenticatedClient();
  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: parsed.data.workspaceId,
    p_user_id: parsed.data.userId,
  });

  if (error) {
    return workspaceError(error.message);
  }

  if (parsed.data.userId === user.id) {
    const { data } = await supabase.rpc("get_my_workspaces");
    const nextWorkspace = data?.find(
      (workspace) => workspace.id !== parsed.data.workspaceId,
    );

    if (nextWorkspace) {
      await setActiveWorkspace(nextWorkspace.id);
    } else {
      const cookieStore = await cookies();
      cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
    }
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/team");
  return { status: "success", message: "Miembro retirado." };
}

export async function acceptInviteAction(formData: FormData) {
  const parsed = invitationTokenSchema.safeParse(formData.get("token"));

  if (!parsed.success) {
    redirect("/invite/invalid");
  }

  const { supabase } = await requireAuthenticatedClient();
  const tokenHash = createHash("sha256")
    .update(parsed.data)
    .digest("hex");
  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_token_hash: tokenHash,
  });

  if (error || !data) {
    redirect(`/invite/${parsed.data}?error=invalid`);
  }

  await setActiveWorkspace(data);
  revalidatePath("/", "layout");
  redirect("/app");
}
