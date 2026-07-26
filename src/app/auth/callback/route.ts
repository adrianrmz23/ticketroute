import { NextResponse } from "next/server";

import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProtocol =
        request.headers.get("x-forwarded-proto") ?? "https";

      if (process.env.NODE_ENV === "development") {
        return NextResponse.redirect(`${origin}${next}`);
      }

      if (forwardedHost) {
        return NextResponse.redirect(
          `${forwardedProtocol}://${forwardedHost}${next}`,
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback`);
}
