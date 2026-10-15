"use client";
// Renders an answer's plain text: paragraphs, "- " bullet lists, [Book C:V] citations as
// chips, and (after verification) flags on any citation or quotation that failed the check.
//
// "use client" (above) marks this as a Client Component: it runs in the browser, so it can
// respond to clicks. Components without it run only on the server.
import { findCitations } from "@/lib/verify/citations";
import { formatReference } from "@/lib/bible/references";
import { isQuoteOk, type CitationStatus, type Verification } from "@/lib/verify";

type Props = {
  text: string;
  verification?: Verification; // undefined while the answer is still streaming
  onCite: (reference: string) => void;
};

// Something to draw in place of a slice of the text (a chip, or a flagged quote).
type Mark = { start: number; end: number; render: (key: number) => React.ReactNode };

const CHIP = "ml-0.5 inline-block rounded px-1.5 font-sans text-[0.8em] font-medium whitespace-nowrap";
const CHIP_STYLES: Record<CitationStatus | "pending", string> = {
  pending: "bg-line/60 text-muted",
  verified: "bg-accent-soft text-accent hover:underline",
  not_retrieved: "bg-warn-soft text-warn line-through",
  invalid: "bg-warn-soft text-warn line-through",
};

function buildMarks(text: string, verification: Verification | undefined, onCite: Props["onCite"]): Mark[] {
  const marks: Mark[] = [];
  const statusByIndex = new Map(verification?.citations.map((c) => [c.index, c]));

  for (const citation of findCitations(text)) {
    const check = statusByIndex.get(citation.index);
    const status = check?.status ?? "pending";
    const title =
      status === "verified" ? "Verified against the World English Bible" : (check?.detail ?? "Checking…");
    const labels = citation.references.length
      ? citation.references.map(formatReference)
      : [citation.raw.slice(1, -1)]; // made-up book: show what the model wrote

    marks.push({
      start: citation.index,
      end: citation.index + citation.length,
      render: (key) => (
        <span key={key}>
          {labels.map((label) =>
            // A made-up reference can't be opened; everything else opens the passage panel.
            status === "invalid" && citation.references.length === 0 ? (
              <span key={label} title={title} className={`${CHIP} ${CHIP_STYLES[status]}`}>
                {label}
              </span>
            ) : (
              <button
                key={label}
                type="button"
                title={title}
                onClick={() => onCite(label)}
                className={`${CHIP} ${CHIP_STYLES[status]}`}
              >
                {label}
              </button>
            ),
          )}
          {(status === "not_retrieved" || status === "invalid") && (
            <span className="ml-1 font-sans text-[0.7em] text-warn">not verified</span>
          )}
        </span>
      ),
    });
  }

  for (const quote of verification?.quotes ?? []) {
    if (isQuoteOk(quote)) continue;
    marks.push({
      start: quote.index,
      end: quote.index + quote.length,
      render: (key) => (
        <mark
          key={key}
          title={quote.detail}
          className="bg-transparent text-inherit underline decoration-warn decoration-wavy underline-offset-4"
        >
          {text.slice(quote.index, quote.index + quote.length)}
        </mark>
      ),
    });
  }

  return marks.sort((a, b) => a.start - b.start);
}

// Draws text[start, end), swapping in any marks that fall inside that range.
function renderRange(text: string, start: number, end: number, marks: Mark[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let pos = start;
  for (const mark of marks) {
    if (mark.start < pos || mark.end > end) continue; // outside this range (or overlapping)
    if (mark.start > pos) out.push(text.slice(pos, mark.start));
    out.push(mark.render(mark.start));
    pos = mark.end;
  }
  if (pos < end) out.push(text.slice(pos, end));
  return out;
}

// Splits text into [start, end) ranges separated by `separator`, keeping original positions.
function ranges(text: string, start: number, end: number, separator: RegExp): [number, number][] {
  const result: [number, number][] = [];
  let pos = start;
  for (const match of text.slice(start, end).matchAll(separator)) {
    result.push([pos, start + match.index]);
    pos = start + match.index + match[0].length;
  }
  result.push([pos, end]);
  return result.filter(([s, e]) => text.slice(s, e).trim() !== "");
}

export function AnswerText({ text, verification, onCite }: Props) {
  const marks = buildMarks(text, verification, onCite);

  return (
    <div className="space-y-3 font-serif text-[1.05rem] leading-relaxed">
      {ranges(text, 0, text.length, /\n{2,}/g).map(([blockStart, blockEnd]) => {
        const lines = ranges(text, blockStart, blockEnd, /\n/g);
        const isList = lines.every(([s, e]) => text.slice(s, e).trimStart().startsWith("- "));

        if (isList) {
          return (
            <ul key={blockStart} className="list-disc space-y-1 pl-5">
              {lines.map(([s, e]) => {
                const itemStart = s + text.slice(s, e).indexOf("- ") + 2; // skip the "- "
                return <li key={s}>{renderRange(text, itemStart, e, marks)}</li>;
              })}
            </ul>
          );
        }
        return (
          <p key={blockStart}>
            {lines.map(([s, e], i) => (
              <span key={s}>
                {i > 0 && " "}
                {renderRange(text, s, e, marks)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
