import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { OnboardingForm } from "@/features/workspaces/components/onboarding-form";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

import styles from "@/features/workspaces/components/workspace-gate.module.css";

export const metadata = {
  title: "Configurar workspace",
};

type OnboardingPageProps = {
  searchParams: Promise<{ new?: string }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/onboarding");
  }

  const { new: createAnother } = await searchParams;
  const { data: workspaces } = await supabase.rpc("get_my_workspaces");
  if (workspaces?.length && createAnother !== "1") {
    redirect("/app");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName =
    profile?.display_name?.split(/\s+/)[0] ??
    user.user_metadata.full_name?.split(/\s+/)[0] ??
    "Owner";

  return (
    <main className={styles.gatePage}>
      <header className={styles.gateTopbar}>
        <BrandMark />
        <span>Identidad verificada · configuración segura</span>
      </header>
      <OnboardingForm displayName={displayName} />
    </main>
  );
}
