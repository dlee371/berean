// Supabase client with the SECRET key. It bypasses Row Level Security, so it is used for
// exactly one thing: the rate-limit counter. Never use it for user data.
//
// `import "server-only"` makes the build fail if this file is ever imported into browser
// code, so the secret key can't leak by accident.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing SUPABASE_SECRET_KEY");
  return createClient(supabaseUrl(), secretKey, { auth: { persistSession: false } });
}
