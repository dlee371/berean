"use client"; // Error boundaries must be Client Components
// Shown when a page fails to load (for example, the database is unreachable).
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4 pt-6">
      <h1 className="font-serif text-2xl font-semibold">Something went wrong.</h1>
      <p className="text-muted">This page couldn&apos;t load. Please try again in a moment.</p>
      <button onClick={() => retry()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-paper">
        Try again
      </button>
    </div>
  );
}
