// Finds bracketed citations like [John 3:16] or [John 3:16-18] in an answer.
// Shared by the server-side checker and the browser (which turns them into chips),
// so both always agree on where each citation is.
import { verseId } from "@/lib/bible/books";
import { findReferences, type Reference } from "@/lib/bible/references";

export type FoundCitation = {
  index: number; // position of "[" in the answer text
  length: number; // length of the whole "[...]" text
  raw: string; // e.g. "[John 3:16]"
  references: Reference[]; // empty if it names no real book, e.g. [Hezekiah 4:2]
};

const BRACKETS = /\[([^[\]\n]{2,80})\]/g;
// "Looks like a citation" = has a chapter:verse number, even if the book name is made up.
const CHAPTER_VERSE = /\d+\s*:\s*\d+/;

export function findCitations(text: string): FoundCitation[] {
  const found: FoundCitation[] = [];
  for (const match of text.matchAll(BRACKETS)) {
    const [raw, inner] = match;
    const references = findReferences(inner);
    // Skip brackets that aren't citations at all, like "[sic]".
    if (references.length === 0 && !CHAPTER_VERSE.test(inner)) continue;
    found.push({ index: match.index, length: raw.length, raw, references });
  }
  return found;
}

// The database ids of the verses a reference covers. John 3:16-18 → three ids.
// A whole-chapter reference ("Psalm 23") has no fixed list; it returns an empty array.
export function referenceVerseIds(ref: Reference): number[] {
  if (ref.verseStart === undefined) return [];
  const end = ref.verseEnd ?? ref.verseStart;
  const ids: number[] = [];
  for (let verse = ref.verseStart; verse <= end; verse++) {
    ids.push(verseId(ref.book.id, ref.chapter, verse));
  }
  return ids;
}
