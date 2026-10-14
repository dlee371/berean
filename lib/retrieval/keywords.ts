// Turns a question into search words that actually appear in the WEB text.
//
// Why: full-text search matches words, not ideas. "anxiety" never appears in the WEB,
// but "anxious" and "worry" do. A small, fast Claude model bridges that gap.
// This step only produces SEARCH WORDS. It never writes the answer, so it can't
// introduce a verse into the answer; everything the user sees still comes from the database.
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAnthropic, KEYWORD_MODEL } from "@/lib/llm/client";

// Zod describes the exact JSON shape we want back. The API is constrained to produce
// JSON matching it, and the SDK checks it again before handing it to us.
const KeywordSchema = z.object({
  on_topic: z.boolean(),
  terms: z.array(z.string()),
});

// `z.infer` turns the Zod schema into a matching TypeScript type automatically.
export type Keywords = z.infer<typeof KeywordSchema> & { source: "claude" | "fallback" };

const SYSTEM_PROMPT = `You turn a Bible-study question into search terms for a keyword (full-text) search over the World English Bible (WEB) translation.

Return:
- on_topic: false if the question has nothing to do with the Bible, faith, theology, or living according to Scripture (for example restaurant recommendations or coding help). Otherwise true.
- terms: 4 to 10 single words or short phrases (2 to 4 words) likely to appear word-for-word in WEB verses that address the question.

Guidelines:
- Use the vocabulary the WEB actually uses. Modern words often don't appear: for "anxiety" use words like "anxious", "worry", "troubled", "afraid"; for "depression" use words like "downcast", "despair", "distress".
- For a named passage or story, include its distinctive words and names (the parable of the sower: "sower", "sow", "seed", "rocky ground", "thorns").
- Include names of people or places when relevant.
- Do not include book names, chapter or verse numbers, or quotations. These are search words only.
- If on_topic is false, return an empty terms list.`;

// Common words that are useless as search terms (used only by the fallback below).
const STOPWORDS = new Set(
  "what does the bible say about how why who when where is are was were a an and or of to in on for with from that this these those do did can could should would will i me my we our you your he she it they them explain mean means meaning tell verse verses scripture".split(
    " ",
  ),
);

// If Claude is unavailable, fall back to the question's own meaningful words.
function fallbackKeywords(question: string): Keywords {
  const words = question
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return { on_topic: true, terms: [...new Set(words)].slice(0, 10), source: "fallback" };
}

export async function expandKeywords(question: string): Promise<Keywords> {
  try {
    const response = await getAnthropic().messages.parse({
      model: KEYWORD_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
      output_config: {
        effort: "low", // a quick, simple task: no need for deep thinking
        format: zodOutputFormat(KeywordSchema),
      },
    });

    // parsed_output is null if the model declined or the JSON didn't match.
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return fallbackKeywords(question);
    }

    const { on_topic, terms } = response.parsed_output;
    const cleaned = terms.map((term) => term.trim()).filter(Boolean).slice(0, 12);
    return { on_topic, terms: cleaned, source: "claude" };
  } catch (error) {
    console.error("Keyword expansion failed, using fallback:", error);
    return fallbackKeywords(question);
  }
}
