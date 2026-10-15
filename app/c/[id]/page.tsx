// /c/[id]: reopen a saved conversation and keep chatting.
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Chat, type Message } from "@/components/Chat";
import { getCurrentUser } from "@/lib/auth";
import { getConversation } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

async function SavedChat({ params }: { params: PageProps<"/c/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // RLS returns nothing for someone else's conversation, so this is also the ownership check.
  const conversation = await getConversation(await createClient(), id);
  if (!conversation) notFound();

  const messages: Message[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.role === "assistant" ? (m.status ?? "answered") : undefined,
    passages: m.passages ?? undefined,
    verification: m.verification ?? undefined,
  }));

  // `key` makes React start a fresh Chat if you move between conversations.
  return <Chat key={id} initialConversationId={id} initialMessages={messages} />;
}

export default function ConversationPage({ params }: PageProps<"/c/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading conversation…</p>}>
      <SavedChat params={params} />
    </Suspense>
  );
}
