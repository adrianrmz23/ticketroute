import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSafeRedirectPath } from "@/domain/auth/safe-redirect";

import { getSupabasePublicEnv } from "./env";

const protectedRoutes = [
  "/app",
  "/onboarding",
  "/invite",
  "/auth/update-password",
];
const guestOnlyRoutes = [
  "/auth/login",
  "/auth/register",
  "/auth/confirm",
  "/auth/recover",
];

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  destination: string,
) {
  const url = new URL(destination, request.url);

  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getSupabasePublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims?.sub) && !error;
  const pathname = request.nextUrl.pathname;

  const requiresAuthentication = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (requiresAuthentication && !authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set(
      "next",
      getSafeRedirectPath(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      ),
    );

    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (authenticated && guestOnlyRoutes.includes(pathname)) {
    return redirectWithCookies(
      request,
      response,
      getSafeRedirectPath(request.nextUrl.searchParams.get("next")),
    );
  }

  return response;
}
