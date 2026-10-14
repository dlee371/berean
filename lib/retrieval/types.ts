// Shared shapes for retrieval. Kept separate so any search method (full-text today,
// vector/semantic later) can plug in without changing the code that uses the results.

export type RetrievedVerse = {
  id: number;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  reference: string; // "John 3:16"
  // How the verse got here: named in the question, found by search, or added as
  // surrounding context for a search hit.
  source: "reference" | "search" | "context";
  score: number | null; // search rank (only for source === "search")
};

// What a search method receives. Full-text search uses `terms`; a future vector search
// would embed `question` instead.
export type SearchQuery = {
  question: string;
  terms: string[];
};

// TypeScript note: an `interface` is like a `type` for objects. Here it's a contract:
// anything calling itself a Retriever must have a `name` and a `search` method with this signature.
export interface Retriever {
  name: string;
  search(query: SearchQuery, limit: number): Promise<RetrievedVerse[]>;
}

// A run of consecutive verses, e.g. John 3:14-18, shown and sent to the model as one block.
export type Passage = {
  reference: string;
  verses: RetrievedVerse[];
};

export type RetrievalResult = {
  found: boolean; // false → the app says "I couldn't find passages" instead of calling Claude
  passages: Passage[];
  verses: RetrievedVerse[]; // every verse in `passages`, in Bible order
  debug: {
    onTopic: boolean;
    searchTerms: string[];
    keywordSource: "claude" | "fallback";
    detectedReferences: string[];
    missingReferences: string[]; // named in the question but not in the Bible (e.g. John 3:52)
    hits: RetrievedVerse[]; // raw search results, best first, before context is added
    minScore: number;
  };
};
