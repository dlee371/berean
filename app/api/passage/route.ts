// GET /api/passage?ref=John%203:16-18 → the whole chapter, with the cited verses marked.
// Used by the side panel when someone clicks a citation.
import { chapterHref, chapterLabel } from "@/lib/bible/books";
import { formatReference, findReferences } from "@/lib/bible/references";
import { getChapter } from "@/lib/bible/queries";

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  const [reference] = findReferences(ref);
  if (!reference) {
    return Response.json({ error: "Unknown reference" }, { status: 404 });
  }

  const { book, chapter, verseStart, verseEnd } = reference;
  if (chapter > book.chapterCount) {
    return Response.json({ error: `${book.name} has only ${book.chapterCount} chapters` }, { status: 404 });
  }
  const verses = await getChapter(book.id, chapter);

  // Highlight the cited verse(s); for a whole-chapter reference, highlight nothing.
  const start = verseStart ?? 0;
  const end = verseEnd ?? verseStart ?? 0;
  if (verseStart !== undefined && !verses.some((v) => v.verse === verseStart)) {
    return Response.json({ error: `${formatReference(reference)} isn't in the Bible` }, { status: 404 });
  }

  return Response.json({
    reference: formatReference(reference),
    title: chapterLabel(book, chapter),
    readerHref: `${chapterHref(book, chapter)}${verseStart ? `#v${verseStart}` : ""}`,
    verses: verses.map((v) => ({ ...v, highlighted: v.verse >= start && v.verse <= end })),
  });
}
