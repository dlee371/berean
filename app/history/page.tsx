// /history: the logged-in user's saved conversations.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteConversation } from "@/app/history/actions";
import { getCurrentUser } from "@/lib/auth";
import { listConversations } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "History · Berean" };

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

async function ConversationList() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await listConversations(await createClient());

  if (conversations.length === 0) {
    return (
      <p className="text-muted">
        No saved conversations yet.{" "}
        <Link href="/" className="text-accent hover:underline">
          Ask a question
        </Link>{" "}
        and it will appear here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {conversations.map((c) => (
        <li key={c.id} className="flex items-center gap-3 px-4 py-3">
          <Link href={`/c/${c.id}`} className="min-w-0 flex-1">
            <span className="block truncate font-medium hover:text-accent">{c.title}</span>
            <span className="text-xs text-muted">{dateFormat.format(new Date(c.updated_at))}</span>
          </Link>
          <form action={deleteConversation}>
            <input type="hidden" name="id" value={c.id} />
            <button className="rounded-md px-2 py-1 text-xs text-muted hover:bg-warn-soft hover:text-warn">
              Delete
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">History</h1>
        <Link href="/" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-paper">
          New chat
        </Link>
      </div>
      {/* Reading the login cookie makes this part request-specific, so it sits in Suspense. */}
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ConversationList />
      </Suspense>
    </div>
  );
}
