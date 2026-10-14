// GET /api/health: a quick "is everything wired up?" check.
// It reports which settings are present (never their values) and pings Supabase.
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

export async function GET() {
  // `Record<string, boolean>` is a type for an object whose keys are strings
  // and whose values are true/false.
  const envPresent: Record<string, boolean> = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  try {
    // Supabase's auth service has a health endpoint. It rejects a wrong key,
    // so a 200 here proves both the URL and the publishable key are correct.
    const res = await fetch(`${supabaseUrl()}/auth/v1/health`, {
      headers: { apikey: supabasePublishableKey() },
      cache: "no-store",
    });

    return Response.json(
      { ok: res.ok, supabase: res.ok ? "connected" : `error ${res.status}`, envPresent },
      { status: res.ok ? 200 : 502 },
    );
  } catch (error) {
    // `error instanceof Error` checks the type before we read `.message`.
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, supabase: message, envPresent }, { status: 500 });
  }
}
