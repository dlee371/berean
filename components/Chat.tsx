"use client";
// The chat screen: question box, streamed answers with citation chips, and the passage panel.
import { useCallback, useRef, useState } from "react";
import { AnswerText } from "@/components/AnswerText";
import { ContextNote } from "@/components/ContextNote";
import { PassagePanel } from "@/components/PassagePanel";
import type { ChatEvent, ClientPassage, HistoryTurn } from "@/lib/chat/events";

type Status = "searching" | "streaming" | "answered" | "not_found" | "refused" | "error";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  passages?: ClientPassage[];
  status?: Status; // assistant messages only
};

const EXAMPLES = [
  "What does the Bible say about anxiety?",
  "Explain the parable of the sower",
  "How should I forgive someone who hurt me?",
  "What is love according to 1 Corinthians 13?",
];

// Reads the server's stream of newline-separated JSON events and calls onEvent for each one.
async function readEvents(response: Response, onEvent: (event: ChatEvent) => void) {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // the last piece may be an incomplete line; keep it for later
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as ChatEvent);
    }
  }
}

export function Chat() {
  // useState holds values that, when changed, make React redraw the screen.
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openReference, setOpenReference] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Updates one message by id. `Partial<Message>` means "some of Message's fields".
  const updateMessage = (id: string, change: (message: Message) => Partial<Message>) =>
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...change(m) } : m)));

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;

    // Earlier finished turns become history, so follow-up questions make sense.
    const history: HistoryTurn[] = messages
      .filter((m) => m.role === "user" || (m.status && m.status !== "error"))
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-12);

    const assistantId = crypto.randomUUID();
    setMessages((all) => [
      ...all,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "", status: "searching" },
    ]);
    setInput("");
    setBusy(true);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      await readEvents(response, (event) => {
        // `switch` on the discriminated union's `type`; TypeScript knows each case's fields.
        switch (event.type) {
          case "retrieval":
            updateMessage(assistantId, () => ({ passages: event.passages, status: "streaming" }));
            break;
          case "text":
            updateMessage(assistantId, (m) => ({ content: m.content + event.text }));
            break;
          case "done":
            updateMessage(assistantId, () => ({ status: event.status }));
            break;
          case "error":
            updateMessage(assistantId, () => ({ status: "error", content: event.message }));
            break;
        }
      });
    } catch {
      updateMessage(assistantId, () => ({
        status: "error",
        content: "Something went wrong. Please try again.",
      }));
    } finally {
      setBusy(false);
    }
  }

  // useCallback keeps the same function between redraws, so the panel's effect doesn't re-run.
  const closePanel = useCallback(() => setOpenReference(null), []);

  return (
    <div className="flex min-h-[60vh] flex-col">
      {messages.length === 0 ? (
        <section className="space-y-6 pt-4">
          <div className="space-y-3">
            <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">
              Search the Scriptures.
            </h1>
            <p className="max-w-prose leading-relaxed text-muted">
              Ask a question and Berean answers using only verses retrieved from the World English
              Bible, citing each one so you can read it in context. Named for the Bereans of Acts
              17:11, who examined the Scriptures to see whether what they heard was so.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => ask(example)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
              >
                {example}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-8 pb-6">
          {messages.map((m) =>
            m.role === "user" ? (
              <p key={m.id} className="ml-auto max-w-[85%] rounded-2xl bg-accent-soft px-4 py-2.5 text-ink">
                {m.content}
              </p>
            ) : (
              <AssistantMessage key={m.id} message={m} onCite={setOpenReference} />
            ),
          )}
        </div>
      )}

      <div ref={bottomRef} />

      <form
        onSubmit={(event) => {
          event.preventDefault(); // stop the browser from reloading the page
          ask(input);
        }}
        className="sticky bottom-0 mt-auto flex gap-2 border-t border-line bg-paper py-3"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={messages.length ? "Ask a follow-up…" : "Ask a question about the Bible…"}
          maxLength={1000}
          aria-label="Your question"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-base"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {openReference && <PassagePanel reference={openReference} onClose={closePanel} />}
    </div>
  );
}

function AssistantMessage({ message, onCite }: { message: Message; onCite: (ref: string) => void }) {
  const { status, content, passages = [] } = message;

  if (status === "searching") {
    return <p className="animate-pulse text-muted">Searching the Scriptures…</p>;
  }
  // Verses found; the model is thinking before it writes its first words.
  if (status === "streaming" && content === "") {
    return <p className="animate-pulse text-muted">Reading the passages…</p>;
  }

  return (
    <article className="space-y-4">
      {status === "error" ? (
        <p className="text-warn">{content}</p>
      ) : (
        <AnswerText text={content} onCite={onCite} />
      )}
      {status === "streaming" && <span className="inline-block h-4 w-2 animate-pulse bg-muted" />}
      {status === "refused" && (
        <p className="text-sm text-warn">Berean wasn&apos;t able to finish answering this question.</p>
      )}

      {passages.length > 0 && status !== "streaming" && (
        <details className="rounded-lg border border-line bg-surface px-4 py-2 text-sm">
          <summary className="cursor-pointer text-muted">Passages consulted ({passages.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-2 pb-2">
            {passages.map((p) => (
              <li key={p.reference}>
                <button onClick={() => onCite(p.reference)} className="text-accent hover:underline">
                  {p.reference}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {status !== "streaming" && <ContextNote />}
    </article>
  );
}
