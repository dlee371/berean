// Supabase client for code that runs in the browser (Client Components).
// It uses the publishable key, so it can only do what RLS policies allow.
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
