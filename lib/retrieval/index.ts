// retrieve(question): finds the verses the answer is allowed to use.
//
//   1. Direct references: "John 3:16" or "Psalm 23" in the question → fetch those verses.
//   2. Keyword expansion: a small Claude model turns the question into WEB vocabulary.
//   3. Search: the Retriever (full-text today) ranks matching verses.
//   4. Context: add the 2 verses before and after each hit, so nothing is read out of context.
//   5. Group consecutive verses into passages (John 3:14-18).
import { verseId } from "@/lib/bible/books";
import { findReferences, formatReference, type Reference } from "@/lib/bible/references";
import { createPublicClient } from "@/lib/supabase/public";
import { fullTextRetriever, toRetrievedVerse } from "@/lib/retrieval/fullText";
import { expandKeywords } from "@/lib/retrieval/keywords";
import type { Passage, RetrievalResult, RetrievedVerse, Retriever } from "@/lib/retrieval/types";

// Tuning knobs. Change these and watch the effect on /search-test.
const SEARCH_LIMIT = 12; // search hits to keep
const CONTEXT_RADIUS = 2; // verses of context on each side of a hit
const MAX_VERSES = 40; // total verses sent to the model
const MAX_REFERENCE_VERSES = 30; // cap for whole-chapter references like "Psalm 119"
// Hits scoring below this are dropped. Scores add up the rarity of matched words (see the
// search_verses SQL). A verse matching only a very common word like "God" or "said" scores
// about 4; one meaningful word like "afraid" or "grace" scores about 10; strong passages 20-60.
const MIN_SCORE = 6;

// Swap this line to change the search method later (e.g. a vector or hybrid retriever).
const retriever: Retriever = fullTextRetriever;

const VERSE_COLUMNS = "id, book_id, chapter, verse, text";

// Fetches verses named directly in the question.
async function fetchReference(ref: Reference): Promise<RetrievedVerse[]> {
  const start = ref.verseStart ?? 1;
  const end = ref.verseEnd ?? (ref.verseStart !== undefined ? ref.verseStart : 999);

  const { data, error } = await createPublicClient()
    .from("verses")
    .select(VERSE_COLUMNS)
    .gte("id", verseId(ref.book.id, ref.chapter, start))
    .lte("id", verseId(ref.book.id, ref.chapter, end))
    .order("id")
    .limit(MAX_REFERENCE_VERSES);
  if (error) throw new Error(`Reference lookup failed: ${error.message}`);

  return (data ?? []).map((row) => toRetrievedVerse(row, "reference"));
}

// Fetches the neighbours of the given verses in one query. Neighbour ids that don't exist
// (before verse 1, or past the end of a chapter) simply aren't returned.
async function fetchContext(verses: RetrievedVerse[]): Promise<RetrievedVerse[]> {
  const ids = new Set<number>();
  for (const v of verses) {
    for (let offset = -CONTEXT_RADIUS; offset <= CONTEXT_RADIUS; offset++) {
      if (offset !== 0 && v.verse + offset >= 1) ids.add(v.id + offset);
    }
  }
  if (ids.size === 0) return [];

  const { data, error } = await createPublicClient()
    .from("verses")
    .select(VERSE_COLUMNS)
    .in("id", [...ids]);
  if (error) throw new Error(`Context lookup failed: ${error.message}`);

  return (data ?? []).map((row) => toRetrievedVerse(row, "context"));
}

// Groups verses (already sorted by id) into runs of consecutive verses.
function groupIntoPassages(verses: RetrievedVerse[]): Passage[] {
  const passages: Passage[] = [];
  for (const v of verses) {
    const current = passages.at(-1)?.verses; // .at(-1) = last item
    const previous = current?.at(-1);
    if (current && previous && previous.id + 1 === v.id) {
      current.push(v);
    } else {
      passages.push({ reference: "", verses: [v] });
    }
  }

  for (const passage of passages) {
    const first = passage.verses[0];
    const last = passage.verses.at(-1)!;
    passage.reference =
      first.id === last.id ? first.reference : `${first.reference}-${last.verse}`;
  }
  return passages;
}

export async function retrieve(question: string): Promise<RetrievalResult> {
  const references = findReferences(question);

  // Run the reference lookups and the keyword expansion at the same time.
  // Promise.all waits for all of them and returns their results in order.
  const [referenceResults, keywords] = await Promise.all([
    Promise.all(references.map(fetchReference)),
    expandKeywords(question),
  ]);

  const missingReferences = references
    .filter((_, i) => referenceResults[i].length === 0)
    .map(formatReference);
  const referenceVerses = referenceResults.flat();

  // Search only if the question is on topic (an off-topic question can still name a verse).
  const hits = keywords.on_topic
    ? (await retriever.search({ question, terms: keywords.terms }, SEARCH_LIMIT)).filter(
        (hit) => (hit.score ?? 0) >= MIN_SCORE,
      )
    : [];

  const context = await fetchContext([...referenceVerses, ...hits]);

  // One entry per verse id, keeping the most important label: a verse that is both a
  // neighbour of one hit and a search hit itself should show as "search".
  const bestById = new Map<number, RetrievedVerse>();
  for (const v of [...context, ...hits, ...referenceVerses]) bestById.set(v.id, v);

  // Fill the verse budget in priority order: named verses first, then each search hit
  // (best first) together with its surrounding context. A Map keeps one entry per verse id.
  const selected = new Map<number, RetrievedVerse>();
  const add = (v: RetrievedVerse | undefined) => {
    if (v && !selected.has(v.id) && selected.size < MAX_VERSES) selected.set(v.id, v);
  };
  const addWithContext = (v: RetrievedVerse) => {
    add(bestById.get(v.id)); // the verse itself first, so it's never squeezed out by its neighbours
    for (let offset = -CONTEXT_RADIUS; offset <= CONTEXT_RADIUS; offset++) {
      add(bestById.get(v.id + offset));
    }
  };
  referenceVerses.forEach((v) => add(bestById.get(v.id)));
  referenceVerses.forEach(addWithContext);
  hits.forEach(addWithContext);

  const verses = [...selected.values()].sort((a, b) => a.id - b.id);

  return {
    found: verses.length > 0,
    passages: groupIntoPassages(verses),
    verses,
    debug: {
      onTopic: keywords.on_topic,
      searchTerms: keywords.terms,
      keywordSource: keywords.source,
      detectedReferences: references.map(formatReference),
      missingReferences,
      hits,
      minScore: MIN_SCORE,
    },
  };
}
