"use client";
// Renders an answer's plain text: paragraphs, "- " bullet lists, and [Book C:V] citations
// as clickable chips that open the passage panel.
//
// "use client" (above) marks this as a Client Component: it runs in the browser, so it can
// respond to clicks. Components without it run only on the server.
import { findReferences, formatReference } from "@/lib/bible/references";

// Matches anything in square brackets that looks like a reference: [John 3:16], [Ps 23:1-3].
const CITATION = /\[([^[\]\n]{2,40}?\d{1,3}:\d{1,3}(?:\s*[-–]\s*\d{1,3})?)\]/g;

type Props = {
  text: string;
  onCite: (reference: string) => void;
};

// Splits one line of text into plain strings and citation chips.
function renderInline(line: string, onCite: Props["onCite"]) {
  // TypeScript note: `React.ReactNode` is "anything React can display": text, elements, etc.
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(CITATION)) {
    const [whole, inner] = match;
    const start = match.index;
    if (start > lastIndex) parts.push(line.slice(lastIndex, start));

    const [reference] = findReferences(inner);
    if (reference) {
      const label = formatReference(reference);
      parts.push(
        <button
          key={start}
          type="button"
          onClick={() => onCite(label)}
          className="ml-0.5 inline-block rounded bg-accent-soft px-1.5 font-sans text-[0.8em] font-medium whitespace-nowrap text-accent hover:underline"
        >
          {label}
        </button>,
      );
    } else {
      // Looks like a citation but isn't a real book (e.g. [Hezekiah 4:2]): show it, unlinked.
      parts.push(
        <span key={start} className="font-sans text-[0.8em] text-muted">
          {whole}
        </span>,
      );
    }
    lastIndex = start + whole.length;
  }

  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts;
}

export function AnswerText({ text, onCite }: Props) {
  // Paragraphs are separated by blank lines.
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim() !== "");

  return (
    <div className="space-y-3 font-serif text-[1.05rem] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => line.trimStart().startsWith("- "));
        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.trimStart().slice(2), onCite)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(lines.join(" "), onCite)}</p>;
      })}
    </div>
  );
}
