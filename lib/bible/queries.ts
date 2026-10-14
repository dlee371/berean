// Database reads for Bible text.
import { cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { verseId } from "@/lib/bible/books";

export type Verse = {
  id: number;
  verse: number;
  text: string;
};

// Loads every verse in one chapter, in order.
export async function getChapter(bookId: number, chapter: number): Promise<Verse[]> {
  // The Bible text doesn't change, so Next.js may reuse this result for days
  // instead of asking the database again. Each (bookId, chapter) is cached separately.
  "use cache";
  cacheLife("days");

  const supabase = createPublicClient();

  // Verse ids for a chapter fall in a neat range: John 3 is 43003000–43003999.
  const { data, error } = await supabase
    .from("verses")
    .select("id, verse, text")
    .gte("id", verseId(bookId, chapter, 0))
    .lte("id", verseId(bookId, chapter, 999))
    .order("id");

  if (error) throw new Error(`Could not load chapter: ${error.message}`);
  // Throwing (instead of returning []) means an empty result is never cached.
  if (!data || data.length === 0) {
    throw new Error("No verses found. Has the import script been run? (npm run import:bible)");
  }
  return data;
}
