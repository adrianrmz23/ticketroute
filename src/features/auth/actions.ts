"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  confirmEmailSchema,
  loginSchema,
  recoverPasswordSchema,
  registerSchema,
  resendCodeSchema,
  updatePasswordSchema,
} from "@/domain/auth/auth-schemas";
import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { getSiteUrl } from "@/infrastructure/supabase/site-url";

import type { AuthActionState } from "./auth-state";

function validationError(
  fieldErrors: Record<string, string[] | undefined>,
): AuthActionState {
  return {
    status: "error",
    message: "Revisa los campos marcados.",
    fieldErrors,
  };
}

function authError(message: string): AuthActionState {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return {
      status: "error",
      message: "El correo o la contraseña no son correctos.",
    };
  }

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed")
  ) {
    return {
      status: "error",
      message: "Confirma tu correo antes de iniciar sesión.",
    };
  }

  if (
    normalized.includes("already registered") ||
    normalized.includes("user_already_exists")
  ) {
    return {
      status: "error",
      message: "Ya existe una cuenta con ese correo.",
    };
  }

  if (
    normalized.includes("expired") ||
    normalized.includes("invalid token") ||
    normalized.includes("token has expired")
  ) {
    return {
      status: "error",
      message: "El código expiró o ya fue utilizado. Solicita uno nuevo.",
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("email rate limit")
  ) {
    return {
      status: "error",
      message: "Espera un momento antes de solicitar otro correo.",
    };
  }

  return {
    status: "error",
    message: "No pudimos completar la operación. Inténtalo nuevamente.",
  };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return authError(error.message);
  }

  revalidatePath("/", "layout");
  redirect(getSafeRedirectPath(parsed.data.next));
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.name,
      },
    },
  });

  if (error) {
    return authError(error.message);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(getSafeRedirectPath(parsed.data.next));
  }

  const next = getSafeRedirectPath(parsed.data.next);
  redirect(
    `/auth/confirm?email=${encodeURIComponent(parsed.data.email)}&next=${encodeURIComponent(next)}`,
  );
}

export async function confirmEmailAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = confirmEmailSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  });

  if (error) {
    return authError(error.message);
  }

  revalidatePath("/", "layout");
  redirect(getSafeRedirectPath(parsed.data.next));
}

export async function resendSignUpCodeAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resendCodeSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    return authError(error.message);
  }

  return {
    status: "success",
    message: "Enviamos un código nuevo. Revisa también correo no deseado.",
  };
}

export async function recoverPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = recoverPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/update-password`,
    },
  );

  if (error) {
    return authError(error.message);
  }

  return {
    status: "success",
    message:
      "Si existe una cuenta con ese correo, recibirás el enlace para restablecerla.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return authError(error.message);
  }

  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/auth/login?message=password-updated");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/auth/login?message=signed-out");
}
