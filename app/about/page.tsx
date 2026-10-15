// /about: how Berean keeps answers grounded in the actual text.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works · Berean",
  description: "How Berean answers only from retrieved Scripture and verifies every citation.",
};

const STEPS = [
  {
    title: "1. Find the verses first",
    body: "Before any AI writes a word, Berean searches the World English Bible for passages related to your question, including the verses around each match so nothing is read out of context. If nothing relevant turns up, Berean says so instead of guessing.",
  },
  {
    title: "2. Answer only from those verses",
    body: "The AI is given only the verses that were found, and told to cite each claim like [John 3:16] and to quote word for word. It is told not to use verses from memory, even well-known ones.",
  },
  {
    title: "3. Check every citation and quotation",
    body: "When the answer is finished, the server checks it against the database. Every citation must be one of the verses that were found, and every quotation must match its verse word for word. Anything that fails is struck through and listed under the answer, so you can see what not to rely on.",
  },
];

export default function AboutPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-serif text-3xl font-semibold">How Berean works</h1>
        <p className="max-w-prose leading-relaxed text-muted">
          AI models can confidently quote verses that don&apos;t exist, or misquote real ones. Berean
          is built so that can&apos;t slip through unnoticed. Like the Bereans of Acts 17:11, it
          checks what it says against the Scriptures.
        </p>
      </header>

      <div className="space-y-4">
        {STEPS.map((step) => (
          <section key={step.title} className="space-y-1 rounded-lg border border-line bg-surface p-5">
            <h2 className="font-semibold">{step.title}</h2>
            <p className="leading-relaxed text-muted">{step.body}</p>
          </section>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">What &ldquo;verified&rdquo; does and doesn&apos;t mean</h2>
        <p className="max-w-prose leading-relaxed text-muted">
          Verified means every reference was really retrieved and every quotation matches the text
          exactly. It doesn&apos;t mean the explanation around them is the right interpretation.
          Berean is a study aid, not a pastor. Click any citation to read it in its chapter, and
          talk with your church community about what you find.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">The text</h2>
        <p className="max-w-prose leading-relaxed text-muted">
          Scripture comes from the World English Bible, a modern public-domain translation published
          by eBible.org. You can read it directly in the{" "}
          <Link href="/read" className="text-accent hover:underline">
            Reader
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
