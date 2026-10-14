// Reads required environment variables and fails loudly if one is missing,
// so you get "Missing NEXT_PUBLIC_SUPABASE_URL" instead of a confusing error later.
//
// TypeScript note: `name: string` means the parameter must be a string,
// and `): string` after the parentheses means the function returns a string.
function required(name: string, value: string | undefined): string {
  // `string | undefined` is a "union type": the value is either a string or missing.
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

// Next.js only inlines NEXT_PUBLIC_ variables into browser code when they're
// written out in full like `process.env.NEXT_PUBLIC_SUPABASE_URL`, so we can't
// look them up dynamically with process.env[name].
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
