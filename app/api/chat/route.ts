// POST /api/chat: { question, history, conversationId? } → a stream of newline-separated
// JSON events. All Claude calls happen here on the server, so the API key never reaches
// the browser. For logged-in users, both the question and the verified answer are saved.
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { answerQuestion } from "@/lib/chat/answer";
import type { ChatEvent } from "@/lib/chat/events";
import { checkRateLimit } from "@/lib/rateLimit";
import { conversationExists, createConversation, saveMessage, type SavedMessage } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

// Allow up to 60 seconds for retrieval plus a streamed answer (the hosting platform's limit).
export const maxDuration = 60;

// Validate the request body. Limits keep a single request from getting huge (and costly).
const RequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(12)
    .default([]),
  conversationId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { question, history } = parsed.data;

  // Checked before any Claude call, so blocked requests cost nothing.
  const limit = await checkRateLimit(request);
  if (!limit.ok) {
    return Response.json({ error: limit.message }, { status: 429 });
  }

  const user = await getCurrentUser();
  const supabase = await createClient();

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: ChatEvent) =>
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

  // A ReadableStream lets us send the response a piece at a time as Claude writes it.
  const body = new ReadableStream({
    async start(controller) {
      // Saving is best-effort: if it fails, the user still gets their answer.
      let conversationId: string | null = null;
      if (user) {
        try {
          const requested = parsed.data.conversationId;
          conversationId =
            requested && (await conversationExists(supabase, requested))
              ? requested
              : await createConversation(supabase, question);
          await saveMessage(supabase, conversationId, {
            role: "user",
            content: question,
            status: null,
            passages: null,
            verification: null,
          });
          send(controller, { type: "conversation", id: conversationId });
        } catch (error) {
          console.error("Saving question failed:", error);
          conversationId = null;
        }
      }

      // Collect the answer as it streams, so it can be saved at the end.
      const answer: Omit<SavedMessage, "id"> = {
        role: "assistant",
        content: "",
        status: null,
        passages: null,
        verification: null,
      };

      try {
        for await (const event of answerQuestion(question, history, request.signal)) {
          send(controller, event);
          if (event.type === "retrieval") answer.passages = event.passages;
          if (event.type === "text") answer.content += event.text;
          if (event.type === "verification") answer.verification = event.verification;
          if (event.type === "done") answer.status = event.status;
        }

        // Only finished answers are saved, with the server's own verification result.
        if (conversationId && answer.status) {
          await saveMessage(supabase, conversationId, answer).catch((error) =>
            console.error("Saving answer failed:", error),
          );
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("Chat failed:", error);
          send(controller, { type: "error", message: "Something went wrong. Please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
