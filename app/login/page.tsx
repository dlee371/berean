import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = { title: "Sign in · Berean" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold">Sign in</h1>
        <p className="text-sm leading-relaxed text-muted">
          Signing in lets you save your conversations and come back to them. You can use Berean
          without an account.
        </p>
      </div>
      {/* The form reads the URL (?error=link), so it sits inside Suspense. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
