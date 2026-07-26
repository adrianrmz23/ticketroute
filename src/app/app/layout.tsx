import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/application/workspaces/get-workspace-context";
import { AppShell } from "@/components/shell/app-shell";
import { signOutAction } from "@/features/auth/actions";
import { selectWorkspaceAction } from "@/features/workspaces/actions";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-MX");
}

export default async function PrivateAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ??
    user.user_metadata.full_name ??
    user.user_metadata.name ??
    user.email?.split("@")[0] ??
    "Usuario";
  const { currentWorkspace, availableWorkspaces } =
    await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      viewer={{
        displayName,
        email: user.email ?? "Sesión autenticada",
        initials: getInitials(displayName) || "TR",
      }}
      currentWorkspace={currentWorkspace}
      availableWorkspaces={availableWorkspaces}
      selectWorkspaceAction={selectWorkspaceAction}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
