// /read/john/3: one chapter of Scripture.
// Each verse has an anchor (#v16), so /read/john/3#v16 jumps to and highlights that verse.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adjacentChapter, chapterHref, findBookBySlug, type Book } from "@/lib/bible/books";
import { getChapter } from "@/lib/bible/queries";

// Turns the URL pieces into a real book + chapter number, or undefined if they're invalid.
function resolve(slug: string, chapterParam: string): { book: Book; chapter: number } | undefined {
  const book = findBookBySlug(slug);
  const chapter = Number(chapterParam);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapterCount) {
    return undefined;
  }
  return { book, chapter };
}

export async function generateMetadata({
  params,
}: PageProps<"/read/[book]/[chapter]">): Promise<Metadata> {
  const { book, chapter } = await params;
  const ref = resolve(book, chapter);
  return { title: ref ? `${ref.book.name} ${ref.chapter} · Berean` : "Not found · Berean" };
}

function ChapterNav({ book, chapter }: { book: Book; chapter: number }) {
  const previous = adjacentChapter(book, chapter, "previous");
  const next = adjacentChapter(book, chapter, "next");
  const linkClass = "rounded-lg border border-line px-3 py-2 hover:bg-accent-soft";

  return (
    <nav className="flex items-center justify-between gap-2 text-sm">
      {previous ? (
        <Link href={chapterHref(previous.book, previous.chapter)} className={linkClass}>
          ← {previous.book.name} {previous.chapter}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={chapterHref(next.book, next.chapter)} className={linkClass}>
          {next.book.name} {next.chapter} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

// The part of the page that depends on the URL. It sits inside <Suspense> (below),
// so Next.js can show the page frame instantly while this part loads.
async function Chapter({ params }: { params: PageProps<"/read/[book]/[chapter]">["params"] }) {
  const { book: slug, chapter: chapterParam } = await params;
  const ref = resolve(slug, chapterParam);
  if (!ref) notFound();

  const { book, chapter } = ref;
  const verses = await getChapter(book.id, chapter);

  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">
        {book.name} {chapter}
      </h1>

      <ChapterNav book={book} chapter={chapter} />

      <div className="font-serif text-lg leading-loose">
        {verses.map((v) => (
          <span key={v.id} id={`v${v.verse}`} className="verse rounded-sm">
            <sup className="mr-1 font-sans text-xs text-muted">{v.verse}</sup>
            {v.text}{" "}
          </span>
        ))}
      </div>

      <ChapterNav book={book} chapter={chapter} />
    </>
  );
}

export default function ChapterPage({ params }: PageProps<"/read/[book]/[chapter]">) {
  return (
    <article className="space-y-6">
      <Link href="/read" className="text-sm text-muted hover:text-ink">
        ← All books
      </Link>
      <Suspense fallback={<p className="text-muted">Loading chapter…</p>}>
        <Chapter params={params} />
      </Suspense>
    </article>
  );
}
