// ML entity detection — the free-text layer the regex detectors can't cover.
// The regex layer catches structured PII (cards, IDs, emails, secrets) with high
// precision; this catches the long tail an agent might leak in prose: arbitrary
// person names, street addresses, cities, organizations. It runs on any
// OpenAI-compatible endpoint (the hosted demo uses Ollama Cloud).
//
// Design for reliability: the model returns entity *substrings*, not character
// offsets (LLMs are unreliable at offsets). We locate each substring in the text
// ourselves, so a span always points at real characters. On any error we return
// [] — detection degrades to regex-only, never crashes the egress.

import OpenAI from "openai";
import type { PiiSpan, PiiType } from "../types.js";

const NER_MODEL = process.env.NER_MODEL || "gpt-oss:20b";

// Only the free-text categories regex can't do. Structured PII is left to regex.
const TYPE_MAP: Record<string, PiiType> = {
  PERSON: "NAME",
  NAME: "NAME",
  ADDRESS: "ADDRESS",
  LOCATION: "LOCATION",
  CITY: "LOCATION",
  GPE: "LOCATION",
  ORG: "ORG",
  ORGANIZATION: "ORG",
  COMPANY: "ORG",
};

const SYSTEM =
  "You are a PII entity extractor. Read the text and return ONLY a JSON array of " +
  'the personal/sensitive entities you find, each as {"type": ..., "value": ...}. ' +
  "Allowed types: PERSON, ADDRESS, LOCATION, ORG. Extract free-text person names, " +
  "street addresses, cities/regions, and organization names. Do NOT extract emails, " +
  "phone numbers, credit-card numbers, or ID numbers — those are handled elsewhere. " +
  "Each `value` MUST be copied verbatim as an exact substring of the input. " +
  "Return [] if there is nothing. No prose, no code fences — just the JSON array.";

/** Lenient parse: accept a bare array, an {entities:[...]}/{result:[...]} wrapper, or JSON embedded in prose. */
function parseEntities(raw: string): Array<{ type?: unknown; value?: unknown }> {
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let parsed = tryParse(raw);
  if (parsed === undefined) {
    // Extract the first bracketed array or object from surrounding text.
    const m = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  if (Array.isArray(parsed)) return parsed as Array<{ type?: unknown; value?: unknown }>;
  if (parsed && typeof parsed === "object") {
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as Array<{ type?: unknown; value?: unknown }>;
    }
  }
  return [];
}

/** Detect free-text PII entities. Returns [] on any failure (regex still runs). */
export async function nerDetect(text: string): Promise<PiiSpan[]> {
  if (!process.env.OPENAI_API_KEY || process.env.NER_DISABLED === "1") return [];
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

  let raw: string;
  try {
    const res = await client.chat.completions.create({
      model: NER_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
    });
    raw = res.choices[0]?.message?.content ?? "[]";
  } catch {
    return [];
  }

  const spans: PiiSpan[] = [];
  for (const item of parseEntities(raw)) {
    const type = TYPE_MAP[String(item.type ?? "").toUpperCase()];
    const value = String(item.value ?? "").trim();
    if (!type || value.length < 2) continue;
    // Locate every verbatim occurrence so offsets index real characters.
    let idx = text.indexOf(value);
    while (idx !== -1) {
      spans.push({ type, value, start: idx, end: idx + value.length });
      idx = text.indexOf(value, idx + value.length);
    }
  }
  return spans;
}

/** Merge regex spans (authoritative) with NER spans that don't overlap them or each other. */
export function mergeSpans(regexSpans: PiiSpan[], nerSpans: PiiSpan[]): PiiSpan[] {
  const kept = [...regexSpans];
  const overlaps = (a: PiiSpan, b: PiiSpan) => a.start < b.end && b.start < a.end;
  for (const n of nerSpans) {
    if (!kept.some((k) => overlaps(k, n))) kept.push(n);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}
