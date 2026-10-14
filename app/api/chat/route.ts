// POST /api/chat: { question, history } → a stream of newline-separated JSON events.
// All Claude calls happen here on the server, so the API key never reaches the browser.
import { z } from "zod";
import { answerQuestion } from "@/lib/chat/answer";
import type { ChatEvent } from "@/lib/chat/events";

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
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { question, history } = parsed.data;

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: ChatEvent) =>
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

  // A ReadableStream lets us send the response a piece at a time as Claude writes it.
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of answerQuestion(question, history, request.signal)) {
          send(controller, event);
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
