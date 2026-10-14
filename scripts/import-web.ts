// One-time import of the World English Bible into Supabase.
//
//   npm run import:bible            → download, check, and upload
//   npm run import:bible -- --dry-run → download and check only (no database writes)
//
// Source: eBible.org's official public-domain WEB release (Protestant edition, "engwebp"),
// in VPL format: one verse per line, like "JOH 3:16 For God so loved the world, ..."
// Safe to run more than once: rows are upserted (insert or update by id).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { unzipSync, strFromU8 } from "fflate";
import { BOOKS, verseId } from "@/lib/bible/books";

const SOURCE_URL = "https://ebible.org/Scriptures/engwebp_vpl.zip";
const CACHE_PATH = "data/engwebp_vpl.zip"; // ignored by git
const TEXT_FILE = "engwebp_vpl.txt";
const BATCH_SIZE = 1000;

type VerseRow = {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
};

// Step 1: get the zip, downloading it only the first time.
// `Promise<Uint8Array>` means "eventually returns raw bytes".
async function loadZip(): Promise<Uint8Array> {
  if (existsSync(CACHE_PATH)) {
    console.log(`Using cached ${CACHE_PATH}`);
    return readFileSync(CACHE_PATH);
  }
  console.log(`Downloading ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  mkdirSync("data", { recursive: true });
  writeFileSync(CACHE_PATH, bytes);
  return bytes;
}

// Step 2: turn the text file into verse rows, checking every line.
function parse(text: string) {
  const codeToBook = new Map(BOOKS.map((book) => [book.code, book]));
  const rows: VerseRow[] = [];
  const skipped: string[] = [];

  // Lines look like: "JOH 3:16 For God so loved..."
  const linePattern = /^([1-3A-Z]{3}) (\d+):(\d+) ?(.*)$/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line === "") continue;

    const match = line.match(linePattern);
    if (!match) throw new Error(`Unexpected line format: ${line.slice(0, 80)}`);

    // Array destructuring: skip the full match, then name each captured group.
    const [, code, chapterStr, verseStr, verseText] = match;
    const book = codeToBook.get(code);
    if (!book) throw new Error(`Unknown book code "${code}"`);

    const chapter = Number(chapterStr);
    const verse = Number(verseStr);

    // The WEB leaves a few verses empty where the oldest manuscripts don't include them.
    if (verseText.trim() === "") {
      skipped.push(`${book.name} ${chapter}:${verse}`);
      continue;
    }

    rows.push({ id: verseId(book.id, chapter, verse), book_id: book.id, chapter, verse, text: verseText });
  }

  return { rows, skipped };
}

// Step 3: sanity checks before we touch the database.
function check(rows: VerseRow[]) {
  const problems: string[] = [];

  for (const book of BOOKS) {
    const bookRows = rows.filter((row) => row.book_id === book.id);
    const maxChapter = Math.max(0, ...bookRows.map((row) => row.chapter));
    if (maxChapter !== book.chapterCount) {
      problems.push(`${book.name}: expected ${book.chapterCount} chapters, found ${maxChapter}`);
    }
  }

  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== rows.length) problems.push("Duplicate verse references found");
  if (rows.length < 31000) problems.push(`Only ${rows.length} verses parsed; expected about 31,100`);

  if (problems.length > 0) {
    throw new Error("Data check failed:\n  " + problems.join("\n  "));
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const files = unzipSync(await loadZip());
  const file = files[TEXT_FILE];
  if (!file) throw new Error(`${TEXT_FILE} not found in zip`);

  const { rows, skipped } = parse(strFromU8(file));
  check(rows);

  const john316 = rows.find((row) => row.id === verseId(43, 3, 16));
  console.log(`Parsed ${rows.length} verses across ${BOOKS.length} books.`);
  console.log(`Skipped ${skipped.length} empty verses: ${skipped.join(", ")}`);
  console.log(`John 3:16 → ${john316?.text}`); // `?.` = "only if john316 exists"

  if (dryRun) {
    console.log("Dry run: nothing written to the database.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  }

  // The secret key bypasses Row Level Security, which is why it stays in scripts/server only.
  const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

  const bookRows = BOOKS.map((book) => ({
    id: book.id,
    code: book.code,
    name: book.name,
    slug: book.slug,
    testament: book.testament,
    chapter_count: book.chapterCount,
  }));
  const { error: bookError } = await supabase.from("books").upsert(bookRows);
  if (bookError) throw new Error(`Books upload failed: ${bookError.message}`);
  console.log("Uploaded 66 books.");

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const { error } = await supabase.from("verses").upsert(batch);
    if (error) throw new Error(`Verse upload failed at row ${start}: ${error.message}`);
    process.stdout.write(`\rUploaded ${Math.min(start + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }
  console.log();

  // Step 4: read back from the database to confirm it matches the source exactly.
  const { count } = await supabase.from("verses").select("*", { count: "exact", head: true });
  const { data: dbJohn } = await supabase
    .from("verses")
    .select("text")
    .eq("id", verseId(43, 3, 16))
    .single();

  console.log(`Database now has ${count} verses (expected ${rows.length}).`);
  console.log(`John 3:16 matches source exactly: ${dbJohn?.text === john316?.text ? "yes" : "NO"}`);
  if (count !== rows.length || dbJohn?.text !== john316?.text) process.exit(1);
  console.log("Import complete.");
}

// Run main(); if anything throws, print the message and exit with an error code.
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
