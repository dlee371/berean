// Full-text search using Postgres (the search_verses SQL function).
import { findBookById } from "@/lib/bible/books";
import { formatReference } from "@/lib/bible/references";
import { createPublicClient } from "@/lib/supabase/public";
import type { RetrievedVerse, Retriever } from "@/lib/retrieval/types";

// The shape of one row returned by search_verses.
type SearchRow = {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
  rank: number;
};

export const fullTextRetriever: Retriever = {
  name: "postgres-full-text",

  async search({ terms }, limit) {
    if (terms.length === 0) return [];

    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("search_verses", {
      terms,
      match_count: limit,
    });
    if (error) throw new Error(`Search failed: ${error.message}`);

    // `as SearchRow[]` tells TypeScript what shape the untyped database rows have.
    return (data as SearchRow[]).map((row) => toRetrievedVerse(row, "search", row.rank));
  },
};

// Converts a database row into the app's RetrievedVerse shape.
export function toRetrievedVerse(
  row: { id: number; book_id: number; chapter: number; verse: number; text: string },
  source: RetrievedVerse["source"], // "the type of the `source` field of RetrievedVerse"
  score: number | null = null, // `= null` is a default value if the caller leaves it out
): RetrievedVerse {
  const book = findBookById(row.book_id)!; // `!` asserts it exists; ids come from our own table
  return {
    id: row.id,
    bookId: row.book_id,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    reference: formatReference({ book, chapter: row.chapter, verseStart: row.verse }),
    source,
    score,
  };
}
