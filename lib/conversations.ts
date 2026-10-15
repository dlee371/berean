// Reading and writing saved conversations. Every function uses the logged-in user's own
// Supabase session, so Row Level Security limits it to that user's rows. Even a bug here
// can't expose someone else's conversations.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientPassage } from "@/lib/chat/events";
import type { Verification } from "@/lib/verify";

export type ConversationSummary = { id: string; title: string; updated_at: string };

export type SavedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "answered" | "not_found" | "refused" | null;
  passages: ClientPassage[] | null;
  verification: Verification | null;
};

// A short title from the first question: "What does the Bible say about anxiety?"
export function titleFromQuestion(question: string): string {
  const oneLine = question.replace(/\s+/g, " ").trim();
  return oneLine.length <= 80 ? oneLine : `${oneLine.slice(0, 77)}…`;
}

export async function createConversation(supabase: SupabaseClient, title: string): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ title: titleFromQuestion(title) })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create conversation: ${error.message}`);
  return data.id;
}

// True if this conversation exists and belongs to the current user (RLS hides all others).
export async function conversationExists(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await supabase.from("conversations").select("id").eq("id", id).maybeSingle();
  return data !== null;
}

export async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  message: Omit<SavedMessage, "id">, // Omit<T, "id"> = all of SavedMessage's fields except id
): Promise<void> {
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, ...message });
  if (error) throw new Error(`Could not save message: ${error.message}`);

  // Bump the conversation to the top of the history list.
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function listConversations(supabase: SupabaseClient): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load conversations: ${error.message}`);
  return data;
}

export async function getConversation(
  supabase: SupabaseClient,
  id: string,
): Promise<{ title: string; messages: SavedMessage[] } | null> {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) return null;

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, role, content, status, passages, verification")
    .eq("conversation_id", id)
    .order("created_at");
  if (error) throw new Error(`Could not load messages: ${error.message}`);

  return { title: conversation.title, messages: messages as SavedMessage[] };
}
