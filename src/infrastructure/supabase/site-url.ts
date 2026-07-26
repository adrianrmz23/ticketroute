import { z } from "zod";

export function getSiteUrl() {
  const parsed = z
    .url()
    .safeParse(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""));

  return parsed.success ? parsed.data : "http://localhost:3000";
}
