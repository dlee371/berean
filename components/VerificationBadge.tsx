// The summary under each answer: "Verified" or a list of what failed the check.
import { isQuoteOk, type Verification } from "@/lib/verify";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function VerificationBadge({ verification }: { verification: Verification }) {
  const { status, citations, quotes } = verification;
  if (status === "no_citations") return null;

  const checkedQuotes = quotes.filter((q) => q.status !== "ignored").length;

  if (status === "verified") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
        <span aria-hidden>✓</span>
        <span>
          <b>Verified.</b> {plural(citations.length, "citation")}
          {checkedQuotes > 0 && ` and ${plural(checkedQuotes, "quotation")}`} checked word for word
          against the World English Bible.
        </span>
      </p>
    );
  }

  // Flagged: list each problem in plain words (tooltips don't work on phones).
  const problems = [
    ...citations
      .filter((c) => c.status !== "verified")
      .map((c) => ({ key: `c${c.index}`, what: c.raw, why: c.detail })),
    ...quotes
      .filter((q) => !isQuoteOk(q))
      .map((q) => ({
        key: `q${q.index}`,
        what: `“${q.text.length > 60 ? q.text.slice(0, 60) + "…" : q.text}”`,
        why: q.detail,
      })),
  ];

  return (
    <div className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
      <p className="flex items-start gap-2">
        <span aria-hidden>⚠</span>
        <span>
          <b>{plural(verification.problems, "problem")} found.</b> The items marked above could not
          be verified against the retrieved verses. Don&apos;t rely on them.
        </span>
      </p>
      <ul className="mt-2 space-y-1 pl-6">
        {problems.map((p) => (
          <li key={p.key}>
            <span className="font-medium">{p.what}</span>: {p.why}
          </li>
        ))}
      </ul>
    </div>
  );
}
