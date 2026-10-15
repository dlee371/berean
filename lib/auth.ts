// Helpers for "who is logged in?" on the server.
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email?: string };

// Returns the logged-in user, or null for visitors.
// getClaims() verifies the login token's signature, so the result can be trusted
// (unlike reading the session cookie directly).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: data.claims.email as string | undefined };
}
