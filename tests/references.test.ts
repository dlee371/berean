import { describe, expect, it } from "vitest";
import { findReferences, formatReference } from "@/lib/bible/references";

const refs = (text: string) => findReferences(text).map(formatReference);

describe("findReferences", () => {
  it("finds common forms", () => {
    expect(refs("What does John 3:16 mean?")).toEqual(["John 3:16"]);
    expect(refs("explain psalm 23")).toEqual(["Psalms 23"]);
    expect(refs("Gen 1:1")).toEqual(["Genesis 1:1"]);
    expect(refs("Mark 4:1-20 parable")).toEqual(["Mark 4:1-20"]);
  });

  it("handles numbered books, abbreviations and odd spacing", () => {
    expect(refs("1 Cor 13:4-7 and 1john 4:8")).toEqual(["1 Corinthians 13:4-7", "1 John 4:8"]);
    expect(refs("Read Phil. 4:6–7")).toEqual(["Philippians 4:6-7"]);
    expect(refs("II Kings 2:11")).toEqual(["2 Kings 2:11"]);
    expect(refs("First John 1:9")).toEqual(["1 John 1:9"]);
    expect(refs("Song of Songs 2:1")).toEqual(["Song of Solomon 2:1"]);
  });

  it("reads one-chapter books as verse numbers", () => {
    expect(refs("Jude 3")).toEqual(["Jude 1:3"]);
  });

  it("ignores made-up books and ordinary words", () => {
    expect(refs("Hezekiah 4:2 says what?")).toEqual([]);
    expect(refs("is 3 enough? I am 5")).toEqual([]);
  });

  it("keeps impossible verses so they can be reported", () => {
    expect(refs("Quote John 3:52")).toEqual(["John 3:52"]);
    expect(refs("Matthew 29:1")).toEqual(["Matthew 29:1"]);
  });

  it("skips an impossible chapter with no verse", () => {
    expect(refs("John 30")).toEqual([]);
  });
});
