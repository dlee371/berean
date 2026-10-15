// The instructions Claude follows when answering, and how retrieved passages are packaged.
import type { RetrievalResult } from "@/lib/retrieval/types";

export const SYSTEM_PROMPT = `You are Berean, a Bible study assistant for the World English Bible (WEB). You are a study aid, not a pastor: be warm, humble, and clear, and point people back to the text itself.

Each question arrives with passages retrieved from the WEB inside <passages>. Those passages are the only Scripture you may use for that answer.

Rules:
1. Base every statement about what the Bible says on the provided passages. Do not rely on verses you remember that are not provided, even well-known ones.
2. After each claim, cite the verse or verses it rests on in square brackets, using the labels exactly as they appear in <passages>: [John 3:16], or a range within one chapter: [John 3:16-18]. Put one reference in each pair of brackets.
3. Only cite references that appear in <passages>.
4. When you quote, copy the words exactly from the passage inside double quotation marks, then give the citation. You may quote part of a verse, but do not change any words, spelling, or punctuation inside the quotation marks, not even with brackets like "fear[ed]". If the exact words don't fit your sentence, paraphrase without quotation marks instead. Use ... where you leave words out.
5. Use double quotation marks only for words of Scripture or words from the user's question. Do not put your own phrases, suggested search terms, or popular sayings in quotation marks.
6. If the passages do not address the question, say so plainly, starting with "I couldn't find passages that clearly address this", and suggest a way to rephrase. Do not fill the gap from memory.
7. If the question refers to a book, chapter, or verse that does not exist in the Bible, say so clearly.
8. Where Christians hold different interpretations, say so briefly instead of presenting one view as settled.
9. Keep answers focused: usually two to four short paragraphs. Write plain text with no headings, bold, italics, or tables. A short bulleted list using "- " is fine.
10. Close by encouraging the reader to read the cited passages in full.
11. Speak to the reader naturally ("Paul writes...", "In Luke, Jesus tells Martha..."). Do not mention "the passages provided" or how they were found.`;

// Builds the user message: the passages, any notes about the question, then the question.
//
//   <passages>
//   <passage reference="John 3:14-18">
//   [John 3:14] As Moses lifted up the serpent ...
//   </passage>
//   </passages>
export function buildUserMessage(question: string, retrieval: RetrievalResult): string {
  const passages = retrieval.passages
    .map((passage) => {
      const lines = passage.verses.map((v) => `[${v.reference}] ${v.text}`).join("\n");
      return `<passage reference="${passage.reference}">\n${lines}\n</passage>`;
    })
    .join("\n");

  const notes: string[] = [];
  for (const missing of retrieval.debug.missingReferences) {
    notes.push(`The question mentions ${missing}, which does not exist in the World English Bible.`);
  }

  return [
    `<passages>\n${passages}\n</passages>`,
    notes.length > 0 ? `<notes>\n${notes.join("\n")}\n</notes>` : "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Shown instead of calling Claude when retrieval finds nothing usable.
export function notFoundMessage(retrieval: RetrievalResult): string {
  const { onTopic, missingReferences } = retrieval.debug;
  if (missingReferences.length > 0) {
    return `I couldn't find ${missingReferences.join(" or ")} in the World English Bible, so I can't quote it. Please check the reference, or browse the Reader.`;
  }
  if (!onTopic) {
    return "Berean answers questions about the Bible, and I couldn't find passages related to this question. Try asking what Scripture says about a topic, person, or passage.";
  }
  return "I couldn't find passages that clearly address this. Try rephrasing your question with different words, or browse the Reader.";
}
