"use server";
// "use server" makes these Server Actions: functions the browser can call (e.g. by
// submitting a form) that always run on the server.
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const Email = z.email().max(320);

// Emails a one-time sign-in link. No password needed.
export async function sendMagicLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = Email.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { status: "error", message: "Please enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error) {
    console.error("Magic link failed:", error.message);
    const rateLimited = error.status === 429;
    return {
      status: "error",
      message: rateLimited
        ? "Too many sign-in emails were sent recently. Please wait a few minutes and try again."
        : "We couldn't send the sign-in email. Please try again.",
    };
  }
  return { status: "sent", email: parsed.data };
}
