// Answers one question: retrieve verses, then stream Claude's answer built only from them.
import type Anthropic from "@anthropic-ai/sdk";
import { ANSWER_MODEL, getAnthropic } from "@/lib/llm/client";
import { retrieve } from "@/lib/retrieval";
import { buildUserMessage, notFoundMessage, SYSTEM_PROMPT } from "@/lib/chat/prompt";
import type { ChatEvent, ClientPassage, HistoryTurn } from "@/lib/chat/events";
import type { RetrievalResult } from "@/lib/retrieval/types";

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

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }

  const final = await stream.finalMessage();
  yield { type: "done", status: final.stop_reason === "refusal" ? "refused" : "answered" };
}
