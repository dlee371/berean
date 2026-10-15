// verifyAnswer: checks every citation and quotation in an answer against the verses that
// were actually retrieved for it. Pure function: no database, no network, easy to test.
//
// Citations
//   verified       every verse it names was in the retrieved set
//   not_retrieved  a real verse, but the model wasn't given it (so it came from memory)
//   invalid        the verse doesn't exist (John 3:52) or the book doesn't (Hezekiah 4:2)
//
// Quotations
//   exact          matches the cited verse(s) word for word
//   wrong_verse    matches a retrieved verse, but not the one it's cited to
//   mismatch       doesn't match the cited verse(s)
//   unsupported    no citation, 4+ words, and not found in any retrieved verse
//   uncited        no citation, but found word for word in a retrieved verse (passes)
//   from_question  repeats words from the user's question, e.g. a saying they asked about (passes)
//   ignored        no citation and under 4 words, e.g. a name or term in quotes (not checked)
import { verseId } from "@/lib/bible/books";
import { formatReference } from "@/lib/bible/references";
import { findCitations, referenceVerseIds, type FoundCitation } from "@/lib/verify/citations";
import { findQuotes, quoteMatches, wordCount } from "@/lib/verify/quotes";

export type VerseLike = { id: number; reference: string; text: string };

export type CitationStatus = "verified" | "not_retrieved" | "invalid";
export type QuoteStatus =
  | "exact"
  | "wrong_verse"
  | "mismatch"
  | "unsupported"
  | "uncited"
  | "from_question"
  | "ignored";

export type CitationCheck = {
  index: number;
  length: number;
  raw: string;
  references: string[]; // formatted, e.g. ["John 3:16-18"]
  status: CitationStatus;
  detail?: string;
};

export type QuoteCheck = {
  index: number;
  length: number;
  text: string;
  citationIndex?: number; // which citation it's attributed to
  status: QuoteStatus;
  detail?: string;
};

export type Verification = {
  status: "verified" | "flagged" | "no_citations";
  citations: CitationCheck[];
  quotes: QuoteCheck[];
  problems: number;
};

const PASSING_QUOTES: QuoteStatus[] = ["exact", "uncited", "from_question", "ignored"];
const MAX_GAP_TO_CITATION = 80; // characters between a quote's end and its citation
const MIN_WORDS_TO_CHECK_UNCITED = 4;

export function isQuoteOk(quote: QuoteCheck): boolean {
  return PASSING_QUOTES.includes(quote.status);
}

export function verifyAnswer(
  answer: string,
  retrieved: VerseLike[],
  // Ids of cited verses that exist in the Bible but weren't retrieved (looked up by the caller).
  // Used only to tell "not_retrieved" apart from "invalid".
  existingIds: Set<number> = new Set(),
  // The user's question. Quoting it back ("Jesus never says 'God helps those who help
  // themselves'") isn't a claim about Scripture, so those quotes aren't checked.
  question = "",
): Verification {
  const byId = new Map(retrieved.map((v) => [v.id, v]));
  const sorted = [...retrieved].sort((a, b) => a.id - b.id);
  const allRetrievedText = sorted.map((v) => v.text).join(" ");

  // ---- Citations --------------------------------------------------------------------
  // For each citation, also remember the text of the verses it covers (for quote checks).
  const found = findCitations(answer);
  const citedText = new Map<number, string>();

  const citations: CitationCheck[] = found.map((c: FoundCitation) => {
    const base = { index: c.index, length: c.length, raw: c.raw };

    if (c.references.length === 0) {
      const name = c.raw.slice(1, -1).replace(/\s*\d.*$/, "");
      return { ...base, references: [], status: "invalid", detail: `There is no book called "${name}" in the Bible.` };
    }

    let status: CitationStatus = "verified";
    let detail: string | undefined;
    const texts: string[] = [];

    for (const ref of c.references) {
      const label = formatReference(ref);
      let ids = referenceVerseIds(ref);

      // Whole-chapter citation like [Psalm 23]: passes if verses from that chapter were retrieved.
      if (ids.length === 0) {
        const chapterStart = verseId(ref.book.id, ref.chapter, 0); // e.g. 19023000 for Psalm 23
        ids = sorted.filter((v) => v.id > chapterStart && v.id < chapterStart + 1000).map((v) => v.id);
        if (ids.length === 0) {
          status = "not_retrieved";
          detail = `${label} wasn't among the passages Berean retrieved for this question.`;
        }
      }

      for (const id of ids) {
        const verse = byId.get(id);
        if (verse) {
          texts.push(verse.text);
        } else if (existingIds.has(id)) {
          if (status === "verified") {
            status = "not_retrieved";
            detail = `${label} is a real verse, but it wasn't among the passages Berean retrieved for this question, so it can't be checked.`;
          }
        } else {
          status = "invalid";
          detail = `${label} doesn't exist in the World English Bible.`;
        }
      }
    }

    citedText.set(c.index, texts.join(" "));
    return { ...base, references: c.references.map(formatReference), status, detail };
  });

  // ---- Quotations -------------------------------------------------------------------
  const quoteSpans = findQuotes(answer);

  const quotes: QuoteCheck[] = quoteSpans.map((q, i) => {
    const base = { index: q.index, length: q.length, text: q.text };
    const quoteEnd = q.index + q.length;
    const nextQuoteStart = quoteSpans[i + 1]?.index ?? Infinity;

    // The quote's citation is the first one shortly after it, before any other quote begins.
    const citation = citations.find(
      (c) => c.index >= quoteEnd && c.index - quoteEnd <= MAX_GAP_TO_CITATION && c.index < nextQuoteStart,
    );

    if (citation) {
      const attached = { ...base, citationIndex: citation.index };

      // Back-to-back citations count as one group: "..." [Colossians 3:14][Colossians 3:15]
      // means the quote comes from somewhere in those verses.
      const group = [citation];
      for (const next of citations.slice(citations.indexOf(citation) + 1)) {
        const last = group[group.length - 1];
        const between = answer.slice(last.index + last.length, next.index);
        if (!/^[\s,;]*(and\s*)?$/.test(between)) break;
        group.push(next);
      }
      const verifiedInGroup = group.filter((c) => c.status === "verified");

      if (verifiedInGroup.length === 0) {
        return { ...attached, status: "mismatch", detail: "Its citation couldn't be verified, so the quote can't be either." };
      }
      const groupText = verifiedInGroup.map((c) => citedText.get(c.index) ?? "").join(" ");
      if (quoteMatches(q.text, groupText)) {
        return { ...attached, status: "exact" };
      }
      const elsewhere = sorted.find((v) => quoteMatches(q.text, v.text));
      if (elsewhere) {
        return {
          ...attached,
          status: "wrong_verse",
          detail: `These words are from ${elsewhere.reference}, not ${citation.references.join(", ")}.`,
        };
      }
      return {
        ...attached,
        status: "mismatch",
        detail: `This quotation doesn't match ${citation.references.join(", ")} word for word.`,
      };
    }

    // No citation nearby.
    if (quoteMatches(q.text, allRetrievedText)) return { ...base, status: "uncited" };
    if (question && quoteMatches(q.text, question)) return { ...base, status: "from_question" };
    if (wordCount(q.text) < MIN_WORDS_TO_CHECK_UNCITED) return { ...base, status: "ignored" };
    return {
      ...base,
      status: "unsupported",
      detail: "This quotation has no citation and doesn't match any retrieved verse.",
    };
  });

  const problems =
    citations.filter((c) => c.status !== "verified").length + quotes.filter((q) => !isQuoteOk(q)).length;

  return {
    status: problems > 0 ? "flagged" : citations.length > 0 ? "verified" : "no_citations",
    citations,
    quotes,
    problems,
  };
}
