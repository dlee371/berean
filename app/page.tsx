// Home page. For now it's a placeholder shell; the real chat arrives in Phase 4.
export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3 pt-6">
        <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">
          Search the Scriptures.
        </h1>
        <p className="max-w-prose leading-relaxed text-muted">
          Ask a question and Berean answers using only verses retrieved from the World English
          Bible, with every citation checked against the text. Named for the Bereans of Acts 17:11,
          who examined the Scriptures to see whether what they heard was so.
        </p>
      </section>

      <form className="flex gap-2">
        <input
          disabled
          placeholder="What does the Bible say about anxiety?"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-base placeholder:text-muted disabled:opacity-70"
        />
        <button
          disabled
          className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper disabled:opacity-50"
        >
          Ask
        </button>
      </form>

      <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-muted">
        Setup in progress: chat is coming soon.
      </p>
    </div>
  );
}
