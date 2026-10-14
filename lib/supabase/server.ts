// Supabase client for code that runs on the server (Server Components, Route Handlers).
// It reads the logged-in user's session from cookies, so queries run *as that user*
// and RLS policies still apply.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// `async` means this function returns a Promise (a value that arrives later),
// and `await` pauses until that value is ready.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // `{ name, value, options }` is "destructuring": pulling fields out of an object.
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. That's fine: the proxy we add
          // in Phase 6 refreshes sessions instead.
        }
      },
    },
  });
}
