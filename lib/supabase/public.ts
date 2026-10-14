// Supabase client for public data that's the same for every visitor (the Bible text).
// Unlike server.ts it doesn't read cookies, which lets Next.js cache pages that use it.
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

export function createPublicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false },
  });
}
