"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type LoginState } from "@/app/login/actions";

export function LoginForm() {
  // useActionState runs the server action when the form is submitted and keeps its
  // latest result in `state`. `pending` is true while it's running.
  const [state, formAction, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });
  const linkFailed = useSearchParams().get("error") === "link";

  if (state.status === "sent") {
    return (
      <div className="space-y-2 rounded-lg border border-line bg-surface p-5">
        <p className="font-medium">Check your email.</p>
        <p className="text-sm leading-relaxed text-muted">
          We sent a sign-in link to <b className="text-ink">{state.email}</b>. Open it on this
          device and browser to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {linkFailed && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          That sign-in link didn&apos;t work or has expired. Please request a new one.
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-sm text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-base"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-warn">{state.message}</p>}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper disabled:opacity-50"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
