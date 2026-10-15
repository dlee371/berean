// Answers one question: retrieve verses, then stream Claude's answer built only from them.
import type Anthropic from "@anthropic-ai/sdk";
import { ANSWER_MODEL, getAnthropic } from "@/lib/llm/client";
import { retrieve } from "@/lib/retrieval";
import { buildUserMessage, notFoundMessage, SYSTEM_PROMPT } from "@/lib/chat/prompt";
import type { ChatEvent, ClientPassage, HistoryTurn } from "@/lib/chat/events";
import type { RetrievalResult } from "@/lib/retrieval/types";
import { createPublicClient } from "@/lib/supabase/public";
import { verifyAnswer } from "@/lib/verify";
import { findCitations, referenceVerseIds } from "@/lib/verify/citations";

// For cited verses the model wasn't given, ask the database which ones really exist,
// so the checker can say "real verse, not retrieved" vs "doesn't exist".
async function lookupExistingIds(answer: string, retrieval: RetrievalResult): Promise<Set<number>> {
  const retrievedIds = new Set(retrieval.verses.map((v) => v.id));
  const unknown = findCitations(answer)
    .flatMap((c) => c.references.flatMap(referenceVerseIds))
    .filter((id) => !retrievedIds.has(id))
    .slice(0, 200);
  if (unknown.length === 0) return new Set();

  const { data, error } = await createPublicClient().from("verses").select("id").in("id", unknown);
  if (error) throw new Error(`Verse lookup failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.id));
}

function toClientPassages(retrieval: RetrievalResult): ClientPassage[] {
  return retrieval.passages.map((passage) => ({
    reference: passage.reference,
    verses: passage.verses.map(({ id, bookId, chapter, verse, reference, text }) => ({
      id,
      bookId,
      chapter,
      verse,
      reference,
      text,
    })),
  }));
}

// TypeScript note: `async function*` makes an "async generator". Instead of returning one
// value at the end, it hands out values one at a time with `yield`, and the caller reads them
// with `for await (const event of answerQuestion(...))`. Perfect for streaming.
export async function* answerQuestion(
  question: string,
  history: HistoryTurn[] = [],
  signal?: AbortSignal, // lets us stop calling Claude if the user closes the page
): AsyncGenerator<ChatEvent> {
  const retrieval = await retrieve(question);
  yield { type: "retrieval", passages: toClientPassages(retrieval) };

  // The key rule: if retrieval found nothing, don't ask the model at all. It can't guess.
  if (!retrieval.found) {
    yield { type: "text", text: notFoundMessage(retrieval) };
    yield { type: "done", status: "not_found" };
    return;
  }

  // Earlier turns are plain text. Only the newest question carries passages.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: buildUserMessage(question, retrieval) },
  ];

  const stream = getAnthropic().beta.messages.stream(
    {
      model: ANSWER_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages,
      output_config: { effort: "medium" },
      // If a safety classifier declines, retry on Anthropic's recommended fallback model
      // instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal },
  );

  let answer = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      answer += event.delta.text;
      yield { type: "text", text: event.delta.text };
    }
  }

  const final = await stream.finalMessage();

  // The anti-hallucination check: every citation and quote is compared with the verses
  // that were actually retrieved, here on the server, before the answer is marked verified.
  const existingIds = await lookupExistingIds(answer, retrieval);
  yield { type: "verification", verification: verifyAnswer(answer, retrieval.verses, existingIds, question) };
  yield { type: "done", status: final.stop_reason === "refusal" ? "refused" : "answered" };
}
