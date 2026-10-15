// Finds Bible references like "John 3:16", "Ps 23", or "1 Cor 13:4-7" in a piece of text.
// Used for direct lookups in retrieval (Phase 3) and for reading citations (Phase 5).
import { BOOKS, type Book } from "@/lib/bible/books";

export type Reference = {
  book: Book;
  chapter: number;
  verseStart?: number; // `?` means optional: missing for whole-chapter references like "Psalm 23"
  verseEnd?: number; // only set for ranges like "John 3:16-18"
};

// Extra names people use for books, beyond the full names in books.ts.
// Deliberately skips abbreviations that are also common English words ("Is", "Am", "Song").
const EXTRA_ALIASES: Record<string, string[]> = {
  genesis: ["Gen", "Gn"],
  exodus: ["Exod", "Exo", "Ex"],
  leviticus: ["Lev", "Lv"],
  numbers: ["Num", "Nm"],
  deuteronomy: ["Deut", "Dt"],
  joshua: ["Josh"],
  judges: ["Judg", "Jdg"],
  "1-samuel": ["1 Sam", "1Sam", "1 Sm"],
  "2-samuel": ["2 Sam", "2Sam", "2 Sm"],
  "1-kings": ["1 Kgs", "1Kgs", "1 Ki"],
  "2-kings": ["2 Kgs", "2Kgs", "2 Ki"],
  "1-chronicles": ["1 Chr", "1Chr", "1 Chron"],
  "2-chronicles": ["2 Chr", "2Chr", "2 Chron"],
  nehemiah: ["Neh"],
  esther: ["Esth"],
  psalms: ["Psalm", "Pss", "Psa", "Ps"],
  proverbs: ["Prov", "Prv"],
  ecclesiastes: ["Eccl", "Eccles", "Qoh"],
  "song-of-solomon": ["Song of Songs", "Canticles"],
  isaiah: ["Isa"],
  jeremiah: ["Jer"],
  lamentations: ["Lam"],
  ezekiel: ["Ezek", "Ezk"],
  daniel: ["Dan", "Dn"],
  hosea: ["Hos"],
  obadiah: ["Obad"],
  micah: ["Mic"],
  nahum: ["Nah"],
  habakkuk: ["Hab"],
  zephaniah: ["Zeph"],
  haggai: ["Hag"],
  zechariah: ["Zech"],
  malachi: ["Mal"],
  matthew: ["Matt", "Mt"],
  mark: ["Mk", "Mrk"],
  luke: ["Lk"],
  john: ["Jn", "Jhn"],
  acts: ["Acts of the Apostles"],
  romans: ["Rom"],
  "1-corinthians": ["1 Cor", "1Cor"],
  "2-corinthians": ["2 Cor", "2Cor"],
  galatians: ["Gal"],
  ephesians: ["Eph"],
  philippians: ["Phil", "Php"],
  colossians: ["Col"],
  "1-thessalonians": ["1 Thess", "1Thess", "1 Thes"],
  "2-thessalonians": ["2 Thess", "2Thess", "2 Thes"],
  "1-timothy": ["1 Tim", "1Tim"],
  "2-timothy": ["2 Tim", "2Tim"],
  titus: ["Tit"],
  philemon: ["Phlm", "Philem"],
  hebrews: ["Heb"],
  james: ["Jas"],
  "1-peter": ["1 Pet", "1Pet", "1 Pt"],
  "2-peter": ["2 Pet", "2Pet", "2 Pt"],
  "1-john": ["1 Jn", "1Jn", "1 Jhn"],
  "2-john": ["2 Jn", "2Jn"],
  "3-john": ["3 Jn", "3Jn"],
  revelation: ["Rev", "Revelations", "Apocalypse"],
};

// Aliases are compared lowercase with spaces removed, so "1 John", "1John" and "1  john" all match.
const normalizeAlias = (alias: string) => alias.toLowerCase().replace(/\s+/g, "");

// Map of normalized alias → Book. Also accepts "First/Second/Third" and Roman numerals
// for numbered books, e.g. "First Corinthians", "II Kings".
const ALIAS_TO_BOOK = new Map<string, Book>();
for (const book of BOOKS) {
  const names = [book.name, ...(EXTRA_ALIASES[book.slug] ?? [])];
  for (const name of names) {
    ALIAS_TO_BOOK.set(normalizeAlias(name), book);
    const numbered = name.match(/^([123]) ?(.+)$/);
    if (numbered) {
      const [, n, rest] = numbered;
      const words = { "1": ["First", "I"], "2": ["Second", "II"], "3": ["Third", "III"] }[n] ?? [];
      for (const word of words) ALIAS_TO_BOOK.set(normalizeAlias(`${word} ${rest}`), book);
    }
  }
}

// Build one regular expression that matches any alias followed by chapter[:verse[-verse]].
// Longest aliases first, so "1 John" wins over "John". Between characters we allow optional
// spaces, so "1john" and "1 john" both match the alias "1john".
const escape = (s: string) => [...s].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
const aliasPattern = [...ALIAS_TO_BOOK.keys()]
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join("|");
const REFERENCE_REGEX = new RegExp(
  `(?<![A-Za-z0-9])(${aliasPattern})\\.?\\s+(\\d{1,3})(?:\\s*:\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?)?(?![\\d:])`,
  "gi", // g = find every match, i = ignore upper/lower case
);

// Finds every reference in `text`. Impossible verses like "John 3:52" or "Matthew 29:1"
// are returned too; callers check them against the database.
export function findReferences(text: string): Reference[] {
  const found: Reference[] = [];

  // matchAll returns every match of a "g" regex; each one is an array of captured groups.
  for (const match of text.matchAll(REFERENCE_REGEX)) {
    const [, alias, chapterStr, verseStr, verseEndStr] = match;
    const book = ALIAS_TO_BOOK.get(normalizeAlias(alias));
    if (!book) continue;

    // In one-chapter books (Jude, Philemon, Obadiah, 2-3 John), "Jude 3" means verse 3.
    if (book.chapterCount === 1 && !verseStr) {
      found.push({ book, chapter: 1, verseStart: Number(chapterStr) });
      continue;
    }

    // A chapter past the end of the book is skipped when it stands alone ("John 30" is more
    // likely a typo than a reference), but kept with a verse ("Matthew 29:1"), so the
    // citation checker can report it as a verse that doesn't exist.
    const chapter = Number(chapterStr);
    if (chapter < 1 || (chapter > book.chapterCount && !verseStr)) continue;

    const reference: Reference = { book, chapter };
    if (verseStr) reference.verseStart = Number(verseStr);
    if (verseEndStr && Number(verseEndStr) > Number(verseStr)) {
      reference.verseEnd = Number(verseEndStr);
    }
    found.push(reference);
  }

  return found;
}

// "John 3:16", "John 3:16-18", or "Psalms 23".
export function formatReference(ref: Reference): string {
  const base = `${ref.book.name} ${ref.chapter}`;
  if (ref.verseStart === undefined) return base;
  if (ref.verseEnd === undefined) return `${base}:${ref.verseStart}`;
  return `${base}:${ref.verseStart}-${ref.verseEnd}`;
}
