// The messages the server streams to the browser while answering, one JSON object per line.
// Shared by the server (which sends them) and the browser (which reads them).
import type { Verification } from "@/lib/verify";

// A verse as the browser needs it (a trimmed-down RetrievedVerse).
export type ClientVerse = {
  id: number;
  bookId: number;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
};

export type ClientPassage = {
  reference: string;
  verses: ClientVerse[];
};

// TypeScript note: this is a "discriminated union". Every event has a `type` field, and
// checking it (if (event.type === "text") ...) tells TypeScript which other fields exist.
export type ChatEvent =
  | { type: "retrieval"; passages: ClientPassage[] } // the verses the answer may use
  | { type: "text"; text: string } // the next piece of the answer
  | { type: "verification"; verification: Verification } // the citation check, after the answer
  | { type: "done"; status: "answered" | "not_found" | "refused" }
  | { type: "error"; message: string };

// One earlier exchange, sent back with follow-up questions so the conversation has memory.
export type HistoryTurn = { role: "user" | "assistant"; content: string };
