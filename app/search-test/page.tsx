// /search-test: a developer page showing raw retrieval results, so you can see exactly
// which verses the AI would be given for a question. Only available in development.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { chapterHref, findBookById } from "@/lib/bible/books";
import { retrieve } from "@/lib/retrieval";
import type { RetrievedVerse } from "@/lib/retrieval/types";

export const metadata: Metadata = { title: "Search test · Berean" };

const EXAMPLES = [
  "What does the Bible say about anxiety?",
  "Explain the parable of the sower",
  "John 3:16",
  "Quote John 3:52",
  "What's the best pizza in Austin?",
];

// Link to the verse in the reader, e.g. /read/john/3#v16.
function verseHref(v: RetrievedVerse): string {
  return `${chapterHref(findBookById(v.bookId)!, v.chapter)}#v${v.verse}`;
}

const SOURCE_STYLES: Record<RetrievedVerse["source"], string> = {
  reference: "bg-accent text-paper",
  search: "bg-accent-soft text-accent",
  context: "border border-line text-muted",
};

function Tag({ source }: { source: RetrievedVerse["source"] }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-sans text-[10px] uppercase ${SOURCE_STYLES[source]}`}>
      {source}
    </span>
  );
}

// Runs retrieval and measures how long it took.
async function timedRetrieve(question: string) {
  const started = performance.now();
  const result = await retrieve(question);
  return { result, ms: Math.round(performance.now() - started) };
}

// Runs retrieval and prints everything. Sits inside <Suspense> because it reads the URL.
async function Results({ searchParams }: { searchParams: PageProps<"/search-test">["searchParams"] }) {
  const { q } = await searchParams;
  const question = typeof q === "string" ? q.trim() : "";
  if (!question) return <p className="text-muted">Enter a question above.</p>;

  const { result, ms } = await timedRetrieve(question);
  const { debug } = result;

  return (
    <div className="space-y-8">
      <section className="space-y-1 rounded-lg border border-line bg-surface p-4 text-sm">
        <p>
          <b>Found:</b>{" "}
          {result.found ? (
            `yes: ${result.verses.length} verses in ${result.passages.length} passages`
          ) : (
            <span className="text-warn">no (the app would say it couldn&apos;t find anything)</span>
          )}{" "}
          <span className="text-muted">({ms} ms)</span>
        </p>
        <p>
          <b>On topic:</b> {debug.onTopic ? "yes" : "no"}
        </p>
        <p>
          <b>Search terms</b> ({debug.keywordSource}): {debug.searchTerms.join(" · ") || "none"}
        </p>
        <p>
          <b>References in question:</b> {debug.detectedReferences.join(", ") || "none"}
          {debug.missingReferences.length > 0 && (
            <span className="text-warn"> (not in the Bible: {debug.missingReferences.join(", ")})</span>
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">
          Search hits, ranked <span className="font-normal text-muted">(min score {debug.minScore})</span>
        </h2>
        {debug.hits.length === 0 ? (
          <p className="text-sm text-muted">No hits above the minimum score.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {debug.hits.map((hit) => (
              <li key={hit.id} className="flex gap-3">
                <span className="w-12 shrink-0 text-right font-mono text-muted">{hit.score?.toFixed(3)}</span>
                <span>
                  <Link href={verseHref(hit)} className="font-medium text-accent hover:underline">
                    {hit.reference}
                  </Link>{" "}
                  <span className="font-serif">{hit.text}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Passages the AI would receive</h2>
        {result.passages.map((passage) => (
          <div key={passage.reference} className="rounded-lg border border-line bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">{passage.reference}</h3>
            <div className="space-y-1 font-serif leading-relaxed">
              {passage.verses.map((v) => (
                <p key={v.id}>
                  <sup className="mr-1 font-sans text-xs text-muted">{v.verse}</sup>
                  {v.text} <Tag source={v.source} />
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function SearchTestPage({ searchParams }: PageProps<"/search-test">) {
  // Developer tool only: each search calls Claude, so it's hidden on the live site.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Search test</h1>
        <p className="text-sm text-muted">Developer view of retrieval. No AI answer is generated here.</p>
      </header>

      {/* A plain GET form: submitting it reloads the page with ?q=... in the URL. */}
      <form className="flex gap-2">
        <input
          name="q"
          placeholder="Ask a question…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3"
        />
        <button className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper">Search</button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs">
        {EXAMPLES.map((example) => (
          <Link
            key={example}
            href={`/search-test?q=${encodeURIComponent(example)}`}
            className="rounded-full border border-line px-3 py-1 text-muted hover:bg-accent-soft"
          >
            {example}
          </Link>
        ))}
      </div>

      <Suspense fallback={<p className="text-muted">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
