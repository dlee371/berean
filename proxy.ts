// Runs before every page request (Next.js 16 calls this "proxy"; it used to be "middleware").
// Its one job: keep the Supabase login session fresh. Login tokens expire after a while;
// asking Supabase for the user here refreshes the token and writes the new cookie.
//
// This is NOT where pages are protected. Each page and API route checks the user itself,
// and Row Level Security in the database is the final guard.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Pass refreshed cookies both to the page being rendered (request) and back to
        // the browser (response).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Checks the login token (and refreshes it if needed). Don't add code between creating
  // the client and this call: it can cause hard-to-debug random logouts.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Every path except Next.js internals, static files, and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
