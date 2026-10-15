// Finds quotations in an answer and checks them against verse text, word for word.

export type FoundQuote = {
  index: number; // position of the opening quotation mark
  length: number; // length including both quotation marks
  text: string; // the words inside the marks
};

// Every quotation, in either "straight" or “curly” double quotes.
export function findQuotes(answer: string): FoundQuote[] {
  const quotes: FoundQuote[] = [];

  // Straight quotes first. The model copies Scripture that itself contains curly quotes
  // (Jesus said, “...”), so curly quotes inside a straight-quoted span are part of the quote.
  for (const match of answer.matchAll(/"([^"\n]{1,800})"/g)) {
    quotes.push({ index: match.index, length: match[0].length, text: match[1] });
  }

  // Then curly quotes that aren't inside a straight-quoted span.
  const insideStraight = (i: number) => quotes.some((q) => i >= q.index && i < q.index + q.length);
  for (const match of answer.matchAll(/“([^“”\n]{1,800})”/g)) {
    if (!insideStraight(match.index)) {
      quotes.push({ index: match.index, length: match[0].length, text: match[1] });
    }
  }

  // Ignore "quotes" with no letters in them.
  return quotes.filter((q) => /[A-Za-z]/.test(q.text)).sort((a, b) => a.index - b.index);
}

// Makes typographic differences irrelevant, without changing any words:
//  - curly apostrophes ’ ‘ → straight '   (the WEB uses ’, models often type ')
//  - double quotation marks removed       (nested quotes inside Scripture)
//  - en/em dashes → hyphen, runs of spaces → one space
// Spelling, word order, and punctuation between words must still match exactly.
export function normalize(text: string): string {
  return text
    .replace(/[‘’‛′`]/g, "'")
    .replace(/[“”‟″"]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Trim punctuation and stray single quotes from the edges of a quoted fragment, since
// quoting part of a sentence naturally starts or stops at a different comma or period.
function trimEdges(fragment: string): string {
  return fragment.replace(/^[\s'.,;:!?-]+|[\s'.,;:!?-]+$/g, "");
}

// Splits a quote at ellipses ("..." or "…"), which mark words left out.
function fragments(quote: string): string[] {
  return normalize(quote)
    .split(/\s*(?:\.\s?\.\s?\.|…)\s*/)
    .map(trimEdges)
    .filter((f) => f.length > 0);
}

// True if every fragment of the quote appears in `source`, in order.
// The first letter may differ in case ("In nothing" quoted from "...in nothing").
export function quoteMatches(quote: string, source: string): boolean {
  const haystack = normalize(source);
  let from = 0;
  for (const fragment of fragments(quote)) {
    const variants = [
      fragment,
      fragment[0].toLowerCase() + fragment.slice(1),
      fragment[0].toUpperCase() + fragment.slice(1),
    ];
    const positions = variants.map((v) => haystack.indexOf(v, from)).filter((p) => p >= 0);
    if (positions.length === 0) return false;
    const at = Math.min(...positions);
    from = at + fragment.length;
  }
  return fragments(quote).length > 0;
}

export function wordCount(text: string): number {
  return normalize(text).split(" ").filter((w) => /[A-Za-z]/.test(w)).length;
}
