// Unit tests for the citation checker, using hand-written answers.
// The real model usually behaves, so these prove the checker catches each kind of failure.
import { describe, expect, it } from "vitest";
import { verifyAnswer, type VerseLike } from "@/lib/verify";

// Exact WEB text for the verses "retrieved" in these tests.
const RETRIEVED: VerseLike[] = [
  { id: 19023001, reference: "Psalm 23:1", text: "A Psalm by David. The LORD is my shepherd; I shall lack nothing." },
  { id: 19023002, reference: "Psalm 23:2", text: "He makes me lie down in green pastures. He leads me beside still waters." },
  { id: 40006009, reference: "Matthew 6:9", text: "Pray like this: “‘Our Father in heaven, may your name be kept holy." },
  { id: 42010041, reference: "Luke 10:41", text: "Jesus answered her, “Martha, Martha, you are anxious and troubled about many things," },
  { id: 43003015, reference: "John 3:15", text: "that whoever believes in him should not perish, but have eternal life." },
  { id: 43003016, reference: "John 3:16", text: "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life." },
  { id: 43003017, reference: "John 3:17", text: "For God didn’t send his Son into the world to judge the world, but that the world should be saved through him." },
  { id: 50004006, reference: "Philippians 4:6", text: "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God." },
  { id: 50004007, reference: "Philippians 4:7", text: "And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus." },
  { id: 60005007, reference: "1 Peter 5:7", text: "casting all your worries on him, because he cares for you." },
];

// Real verses that exist but were NOT retrieved (the caller looks these up in the database).
const EXISTING = new Set([45005008]); // Romans 5:8

const check = (answer: string) => verifyAnswer(answer, RETRIEVED, EXISTING);

describe("correct answers pass", () => {
  it("verifies citations and exact quotes", () => {
    const result = check(
      'Paul writes, "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God." [Philippians 4:6] Peter adds that we can cast our worries on God [1 Peter 5:7].',
    );
    expect(result.status).toBe("verified");
    expect(result.problems).toBe(0);
    expect(result.citations).toHaveLength(2);
    expect(result.quotes[0].status).toBe("exact");
  });

  it("treats straight and curly apostrophes as the same", () => {
    // The WEB has "didn’t" (curly); models often type "didn't" (straight).
    const result = check('Jesus says, "For God didn\'t send his Son into the world to judge the world" [John 3:17].');
    expect(result.quotes[0].status).toBe("exact");
  });

  it("allows the first letter's case to change when quoting mid-sentence", () => {
    const result = check('Peter says to go on "Casting all your worries on him" [1 Peter 5:7].');
    expect(result.quotes[0].status).toBe("exact");
  });

  it("accepts ellipses for left-out words, as long as the pieces appear in order", () => {
    const result = check('"For God so loved the world ... that whoever believes in him should not perish" [John 3:16]');
    expect(result.quotes[0].status).toBe("exact");
  });

  it("rejects ellipsis pieces that are out of order", () => {
    const result = check('"that whoever believes in him ... For God so loved the world" [John 3:16]');
    expect(result.quotes[0].status).toBe("mismatch");
  });

  it("checks a quote against back-to-back citations together", () => {
    // The words are in John 3:16, which is the second of the two citations.
    expect(check('"For God so loved the world" [John 3:15][John 3:16]').quotes[0].status).toBe("exact");
    expect(check('"For God so loved the world" [John 3:15], [John 3:16]').quotes[0].status).toBe("exact");
  });

  it("accepts a quote spanning a cited range", () => {
    const result = check('"but have eternal life. For God so loved the world" [John 3:15-16]');
    expect(result.status).toBe("verified");
  });

  it("ignores Scripture's own nested quotation marks", () => {
    const result = check('Jesus taught, "Our Father in heaven, may your name be kept holy." [Matthew 6:9]');
    expect(result.quotes[0].status).toBe("exact");
  });

  it("understands abbreviations and several references in one bracket", () => {
    const result = check("God's love and peace [Jn 3:16; Phil 4:7].");
    expect(result.status).toBe("verified");
    expect(result.citations[0].references).toEqual(["John 3:16", "Philippians 4:7"]);
  });

  it("verifies a whole-chapter citation when verses from that chapter were retrieved", () => {
    expect(check("The LORD is a shepherd [Psalm 23].").status).toBe("verified");
  });

  it("ignores brackets that aren't citations", () => {
    expect(check("Something [sic] and nothing else.").status).toBe("no_citations");
  });

  it("reports no_citations when the answer cites nothing", () => {
    expect(check("I couldn't find passages that clearly address this.").status).toBe("no_citations");
  });
});

describe("made-up and unretrieved citations are caught", () => {
  it("flags a book that doesn't exist", () => {
    const result = check("As it says in [Hezekiah 4:2], God helps those who help themselves.");
    expect(result.status).toBe("flagged");
    expect(result.citations[0].status).toBe("invalid");
    expect(result.citations[0].detail).toContain("Hezekiah");
  });

  it("flags a verse number past the end of the chapter", () => {
    const result = check("Jesus also said this [John 3:52].");
    expect(result.citations[0].status).toBe("invalid");
  });

  it("flags a chapter past the end of the book", () => {
    expect(check("Then he ascended [Matthew 29:1].").citations[0].status).toBe("invalid");
  });

  it("flags a range that runs past the verses that exist", () => {
    // John 3:15-17 are retrieved; 3:18-19 are not, and aren't in EXISTING either.
    expect(check("See [John 3:15-19].").citations[0].status).toBe("invalid");
  });

  it("flags a real verse the model wasn't given (it came from memory)", () => {
    const result = check('"Christ died for us" [Romans 5:8].');
    expect(result.citations[0].status).toBe("not_retrieved");
    expect(result.quotes[0].status).toBe("mismatch"); // can't check a quote against an unchecked verse
    expect(result.problems).toBe(2);
  });

  it("flags a whole-chapter citation with nothing retrieved from it", () => {
    expect(check("See [Psalm 91].").citations[0].status).toBe("not_retrieved");
  });
});

describe("misquotes are caught", () => {
  it("flags a different translation's wording", () => {
    // KJV wording, not WEB.
    const result = check('"For God so loved the world, that he gave his only begotten Son" [John 3:16]');
    expect(result.quotes[0].status).toBe("mismatch");
    expect(result.status).toBe("flagged");
  });

  it("flags a dropped word", () => {
    // Real WEB: "In nothing be anxious, but in everything, by prayer..." ("be" dropped here)
    expect(check('"In nothing anxious, but in everything" [Philippians 4:6]').quotes[0].status).toBe("mismatch");
  });

  it("flags an added word", () => {
    const result = check('"In nothing be anxious at all" [Philippians 4:6]');
    expect(result.quotes[0].status).toBe("mismatch");
  });

  it("flags a real quote attached to the wrong verse", () => {
    const result = check('"For God so loved the world" [John 3:17]');
    expect(result.quotes[0].status).toBe("wrong_verse");
    expect(result.quotes[0].detail).toContain("John 3:16");
  });

  it("flags a long uncited quote that isn't in any retrieved verse", () => {
    const result = check('Many people believe "God helps those who help themselves," but that is not Scripture.');
    expect(result.quotes[0].status).toBe("unsupported");
  });

  it("accepts an uncited quote that matches a retrieved verse word for word", () => {
    expect(check('Remember: "The LORD is my shepherd."').quotes[0].status).toBe("uncited");
  });

  it("ignores short uncited phrases in quotes, like names or terms", () => {
    const result = check('The word "shepherd" here, and the name "Ezekiel" there.');
    expect(result.quotes.map((q) => q.status)).toEqual(["uncited", "ignored"]);
    expect(result.problems).toBe(0);
  });

  it("allows quoting the user's own question back to them", () => {
    const question = "Where does Jesus say 'God helps those who help themselves'?";
    const answer = 'Jesus never says "God helps those who help themselves." It is a popular proverb.';
    expect(verifyAnswer(answer, RETRIEVED, EXISTING, question).quotes[0].status).toBe("from_question");
    // Without the question, the same quote is unsupported.
    expect(verifyAnswer(answer, RETRIEVED, EXISTING).quotes[0].status).toBe("unsupported");
  });

  it("flags words altered with brackets", () => {
    // Real WEB: "In nothing be anxious, ..." — "be[ing]" changes the words.
    expect(check('"In nothing be[ing] anxious" [Philippians 4:6]').quotes[0].status).toBe("mismatch");
  });

  it("only attaches a citation that comes right after the quote", () => {
    const filler = " and here is a long stretch of commentary that goes on well past eighty characters before any citation ";
    const result = check(`"In nothing be anxious at all"${filler}[Philippians 4:6]`);
    expect(result.quotes[0].citationIndex).toBeUndefined();
    expect(result.quotes[0].status).toBe("unsupported");
  });
});
