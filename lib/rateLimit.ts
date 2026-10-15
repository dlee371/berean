// Limits how many questions can be asked, to protect the Claude API bill.
import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Tune these to your budget. Each question costs roughly $0.01-0.03.
const LIMITS = {
  perVisitorPerHour: 20, // one person (by IP address)
  globalPerDay: 500, // everyone combined: a hard daily ceiling
};

export type RateLimitResult = { ok: true } | { ok: false; message: string };

// The visitor's IP address as reported by the hosting platform (Vercel sets this header).
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

// Store a hash of the IP, not the IP itself, so the database never holds addresses.
function hashIp(ip: string): string {
  return createHash("sha256").update(`berean:${ip}`).digest("hex").slice(0, 32);
}

export async function checkRateLimit(request: Request): Promise<RateLimitResult> {
  try {
    const supabase = createAdminClient();
    const check = (key: string, limit: number, windowSeconds: number) =>
      supabase.rpc("check_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });

    const [visitor, global] = await Promise.all([
      check(`ip:${hashIp(clientIp(request))}`, LIMITS.perVisitorPerHour, 3600),
      check("global", LIMITS.globalPerDay, 86400),
    ]);
    if (visitor.error || global.error) throw visitor.error ?? global.error;

    if (!visitor.data) {
      return { ok: false, message: "You've asked a lot of questions this hour. Please take a break and try again later." };
    }
    if (!global.data) {
      return { ok: false, message: "Berean has reached its daily limit. Please come back tomorrow." };
    }
    return { ok: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // In development, don't block yourself over a missing setup step. In production,
    // refuse rather than risk an unlimited bill.
    return process.env.NODE_ENV === "production"
      ? { ok: false, message: "Berean is temporarily unavailable. Please try again soon." }
      : { ok: true };
  }
}
