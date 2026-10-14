// GET /api/passage?ref=John%203:16-18 → the whole chapter, with the cited verses marked.
// Used by the side panel when someone clicks a citation.
import { chapterHref } from "@/lib/bible/books";
import { formatReference, findReferences } from "@/lib/bible/references";
import { getChapter } from "@/lib/bible/queries";

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  const [reference] = findReferences(ref);
  if (!reference) {
    return Response.json({ error: "Unknown reference" }, { status: 404 });
  }

  const { book, chapter, verseStart, verseEnd } = reference;
  const verses = await getChapter(book.id, chapter);

  // Highlight the cited verse(s); for a whole-chapter reference, highlight nothing.
  const start = verseStart ?? 0;
  const end = verseEnd ?? verseStart ?? 0;
  if (verseStart !== undefined && !verses.some((v) => v.verse === verseStart)) {
    return Response.json({ error: `${formatReference(reference)} isn't in the Bible` }, { status: 404 });
  }

  return Response.json({
    reference: formatReference(reference),
    title: `${book.name} ${chapter}`,
    readerHref: `${chapterHref(book, chapter)}${verseStart ? `#v${verseStart}` : ""}`,
    verses: verses.map((v) => ({ ...v, highlighted: v.verse >= start && v.verse <= end })),
  });
}
