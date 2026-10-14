// The 66 books of the Protestant canon, in order.
// Used by the import script (to fill the `books` table) and by the reader (for navigation),
// so the app doesn't need a database call just to list book names.

// TypeScript note: a `type` describes the shape of an object. Any object labeled
// `Book` must have exactly these fields with these value types.
// `"OT" | "NT"` means the value must be one of those two exact strings.
export type Book = {
  id: number;
  code: string; // 3-letter code used in the eBible VPL source file
  name: string;
  slug: string;
  testament: "OT" | "NT";
  chapterCount: number;
};

// `[id, code, name, chapterCount]`: a compact table we expand into Book objects below.
// `as const` tells TypeScript these values never change.
const RAW = [
  [1, "GEN", "Genesis", 50],
  [2, "EXO", "Exodus", 40],
  [3, "LEV", "Leviticus", 27],
  [4, "NUM", "Numbers", 36],
  [5, "DEU", "Deuteronomy", 34],
  [6, "JOS", "Joshua", 24],
  [7, "JDG", "Judges", 21],
  [8, "RUT", "Ruth", 4],
  [9, "1SA", "1 Samuel", 31],
  [10, "2SA", "2 Samuel", 24],
  [11, "1KI", "1 Kings", 22],
  [12, "2KI", "2 Kings", 25],
  [13, "1CH", "1 Chronicles", 29],
  [14, "2CH", "2 Chronicles", 36],
  [15, "EZR", "Ezra", 10],
  [16, "NEH", "Nehemiah", 13],
  [17, "EST", "Esther", 10],
  [18, "JOB", "Job", 42],
  [19, "PSA", "Psalms", 150],
  [20, "PRO", "Proverbs", 31],
  [21, "ECC", "Ecclesiastes", 12],
  [22, "SOL", "Song of Solomon", 8],
  [23, "ISA", "Isaiah", 66],
  [24, "JER", "Jeremiah", 52],
  [25, "LAM", "Lamentations", 5],
  [26, "EZE", "Ezekiel", 48],
  [27, "DAN", "Daniel", 12],
  [28, "HOS", "Hosea", 14],
  [29, "JOE", "Joel", 3],
  [30, "AMO", "Amos", 9],
  [31, "OBA", "Obadiah", 1],
  [32, "JON", "Jonah", 4],
  [33, "MIC", "Micah", 7],
  [34, "NAH", "Nahum", 3],
  [35, "HAB", "Habakkuk", 3],
  [36, "ZEP", "Zephaniah", 3],
  [37, "HAG", "Haggai", 2],
  [38, "ZEC", "Zechariah", 14],
  [39, "MAL", "Malachi", 4],
  [40, "MAT", "Matthew", 28],
  [41, "MAR", "Mark", 16],
  [42, "LUK", "Luke", 24],
  [43, "JOH", "John", 21],
  [44, "ACT", "Acts", 28],
  [45, "ROM", "Romans", 16],
  [46, "1CO", "1 Corinthians", 16],
  [47, "2CO", "2 Corinthians", 13],
  [48, "GAL", "Galatians", 6],
  [49, "EPH", "Ephesians", 6],
  [50, "PHI", "Philippians", 4],
  [51, "COL", "Colossians", 4],
  [52, "1TH", "1 Thessalonians", 5],
  [53, "2TH", "2 Thessalonians", 3],
  [54, "1TI", "1 Timothy", 6],
  [55, "2TI", "2 Timothy", 4],
  [56, "TIT", "Titus", 3],
  [57, "PHM", "Philemon", 1],
  [58, "HEB", "Hebrews", 13],
  [59, "JAM", "James", 5],
  [60, "1PE", "1 Peter", 5],
  [61, "2PE", "2 Peter", 3],
  [62, "1JO", "1 John", 5],
  [63, "2JO", "2 John", 1],
  [64, "3JO", "3 John", 1],
  [65, "JUD", "Jude", 1],
  [66, "REV", "Revelation", 22],
] as const;

// `Book[]` means "an array of Book objects".
export const BOOKS: Book[] = RAW.map(([id, code, name, chapterCount]) => ({
  id,
  code,
  name,
  slug: name.toLowerCase().replace(/ /g, "-"), // "1 Samuel" → "1-samuel"
  testament: id <= 39 ? "OT" : "NT",
  chapterCount,
}));

// Returns the matching book, or `undefined` if there's no such slug.
export function findBookBySlug(slug: string): Book | undefined {
  return BOOKS.find((book) => book.slug === slug);
}

export function findBookById(id: number): Book | undefined {
  return BOOKS.find((book) => book.id === id);
}

export type ChapterRef = { book: Book; chapter: number };

// The chapter before or after this one, crossing book boundaries
// (Malachi 4 → Matthew 1). Returns undefined at Genesis 1 / Revelation 22.
export function adjacentChapter(
  book: Book,
  chapter: number,
  direction: "previous" | "next",
): ChapterRef | undefined {
  if (direction === "next") {
    if (chapter < book.chapterCount) return { book, chapter: chapter + 1 };
    const nextBook = findBookById(book.id + 1);
    return nextBook ? { book: nextBook, chapter: 1 } : undefined;
  }

  if (chapter > 1) return { book, chapter: chapter - 1 };
  const previousBook = findBookById(book.id - 1);
  return previousBook ? { book: previousBook, chapter: previousBook.chapterCount } : undefined;
}

export function chapterHref(book: Book, chapter: number): string {
  return `/read/${book.slug}/${chapter}`;
}

// Builds the numeric verse id used in the database (see the migration file).
export function verseId(bookId: number, chapter: number, verse: number): number {
  return bookId * 1_000_000 + chapter * 1_000 + verse;
}
