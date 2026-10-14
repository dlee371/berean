// One shared Anthropic client for the whole server.
// It reads ANTHROPIC_API_KEY from the environment. Only ever import this from server code
// (Route Handlers, Server Components, scripts) so the key never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";

// Fast, inexpensive model for small helper jobs (turning a question into search words).
export const KEYWORD_MODEL = "claude-haiku-5-5";
// Model that writes the actual answers (Phase 4).
export const ANSWER_MODEL = "claude-sonnet-5-5";

// Created on first use rather than at import time, so a missing key only errors
// when we actually call Claude (not during `next build`).
let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  client ??= new Anthropic(); // `??=` assigns only if `client` is still undefined
  return client;
}
