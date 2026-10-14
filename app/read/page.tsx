// /read: pick a book, then a chapter.
// Uses plain <details> elements so it works without any JavaScript.
import type { Metadata } from "next";
import Link from "next/link";
import { BOOKS, chapterHref, type Book } from "@/lib/bible/books";

export const metadata: Metadata = { title: "Read · Berean" };

function BookList({ title, books }: { title: string; books: Book[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">{title}</h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {books.map((book) => (
          <li key={book.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-serif">
                {book.name}
                <span className="text-xs text-muted group-open:rotate-90">›</span>
              </summary>
              <div className="grid grid-cols-6 gap-1 px-4 pb-4 sm:grid-cols-10">
                {/* Array.from({ length: n }) makes a list of n items; we only need the index i. */}
                {Array.from({ length: book.chapterCount }, (_, i) => (
                  <Link
                    key={i}
                    href={chapterHref(book, i + 1)}
                    className="rounded-md py-2 text-center text-sm hover:bg-accent-soft"
                  >
                    {i + 1}
                  </Link>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReadIndex() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold">Read</h1>
      <BookList title="Old Testament" books={BOOKS.filter((b) => b.testament === "OT")} />
      <BookList title="New Testament" books={BOOKS.filter((b) => b.testament === "NT")} />
    </div>
  );
}
