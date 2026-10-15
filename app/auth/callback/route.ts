// GET /auth/callback: where the sign-in email link lands. Turns the one-time code in the
// link into a login session (stored in cookies), then sends the user to the chat.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const supabase = await createClient();

  // Supabase's default email sends a `code`; a customized template can send `token_hash`.
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing code") };

  if (error) {
    console.error("Sign-in link failed:", error.message);
    return NextResponse.redirect(`${siteUrl()}/login?error=link`);
  }
  return NextResponse.redirect(`${siteUrl()}/history`);
}
