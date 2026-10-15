// Runs every question in eval-questions.json through the real pipeline (the same
// answerQuestion() the website uses) and reports whether every citation passed verification.
//
//   npm run eval                 → all questions
//   npm run eval -- sower anxiety → only the questions with these ids
//
// Each run calls Claude, so it costs a little (roughly $0.01-0.03 per question).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { answerQuestion } from "@/lib/chat/answer";
import { isQuoteOk, type Verification } from "@/lib/verify";

type EvalCase = {
  id: string;
  question: string;
  note?: string;
  expect: {
    status?: "answered" | "not_found"; // leave out to accept either
    mustMatch?: string; // regular expression the answer must match (case-insensitive)
    allowNoCitations?: boolean; // true if a correct answer may cite nothing
  };
};

type EvalResult = {
  id: string;
  question: string;
  status: string;
  answer: string;
  verification?: Verification;
  seconds: number;
  failures: string[];
};

async function runOne(item: EvalCase): Promise<EvalResult> {
  const started = performance.now();
  let answer = "";
  let status = "unknown";
  let verification: Verification | undefined;

  try {
    for await (const event of answerQuestion(item.question)) {
      if (event.type === "text") answer += event.text;
      if (event.type === "verification") verification = event.verification;
      if (event.type === "done") status = event.status;
      if (event.type === "error") status = "error";
    }
  } catch (error) {
    status = "error";
    answer = error instanceof Error ? error.message : String(error);
  }

  // Decide pass/fail.
  const failures: string[] = [];
  const { expect } = item;

  if (status === "error" || status === "refused") failures.push(`run ended with "${status}"`);
  if (expect.status && status !== expect.status) failures.push(`expected ${expect.status}, got ${status}`);

  if (verification?.status === "flagged") {
    for (const c of verification.citations.filter((c) => c.status !== "verified")) {
      failures.push(`citation ${c.raw}: ${c.status}`);
    }
    for (const q of verification.quotes.filter((q) => !isQuoteOk(q))) {
      failures.push(`quote "${q.text.slice(0, 50)}": ${q.status}`);
    }
  }
  if (status === "answered" && verification?.status === "no_citations" && !expect.allowNoCitations) {
    failures.push("answer has no citations");
  }
  if (expect.mustMatch && !new RegExp(expect.mustMatch, "i").test(answer)) {
    failures.push(`answer doesn't match /${expect.mustMatch}/`);
  }

  return {
    id: item.id,
    question: item.question,
    status,
    answer,
    verification,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    failures,
  };
}

// Runs `worker` over `items` with at most `limit` running at once, keeping the original order.
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
      process.stdout.write(".");
    }
  });
  await Promise.all(runners);
  console.log();
  return results;
}

async function main() {
  const all: EvalCase[] = JSON.parse(readFileSync("scripts/eval-questions.json", "utf8"));
  const only = process.argv.slice(2);
  const cases = only.length ? all.filter((c) => only.includes(c.id)) : all;

  console.log(`Running ${cases.length} questions…`);
  const results = await mapLimit(cases, 3, runOne);

  // Summary table.
  const rows = results.map((r) => {
    const v = r.verification;
    const citations = v ? `${v.citations.filter((c) => c.status === "verified").length}/${v.citations.length}` : "-";
    const quotes = v
      ? `${v.quotes.filter((q) => q.status !== "ignored" && isQuoteOk(q)).length}/${v.quotes.filter((q) => q.status !== "ignored").length}`
      : "-";
    return {
      result: r.failures.length === 0 ? "PASS" : "FAIL",
      id: r.id,
      status: r.status,
      check: v?.status ?? "-",
      citations,
      quotes,
      secs: r.seconds,
    };
  });
  console.table(rows);

  for (const r of results.filter((r) => r.failures.length > 0)) {
    console.log(`\n✗ ${r.id}: ${r.question}`);
    for (const failure of r.failures) console.log(`   - ${failure}`);
  }

  const passed = results.filter((r) => r.failures.length === 0).length;
  const totalCitations = results.reduce((n, r) => n + (r.verification?.citations.length ?? 0), 0);
  const badCitations = results.reduce(
    (n, r) => n + (r.verification?.citations.filter((c) => c.status !== "verified").length ?? 0),
    0,
  );
  console.log(`\n${passed}/${results.length} questions passed.`);
  console.log(`${totalCitations - badCitations}/${totalCitations} citations verified across all answers.`);

  // Full answers, for reading through afterwards.
  mkdirSync("eval-results", { recursive: true });
  const file = `eval-results/eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(`Full answers saved to ${file}`);

  process.exit(passed === results.length ? 0 : 1);
}

main();
