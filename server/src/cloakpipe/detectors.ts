// Deterministic PII detection. Regex-based, ordered by priority so overlapping
// matches resolve to the most sensitive interpretation. This is the layer that
// makes the demo safe: the agent is non-deterministic, but detection is not.

import type { PiiSpan, PiiType } from "../types.js";

interface Detector {
  type: PiiType;
  priority: number; // higher wins on overlap
  regex: RegExp;
  /** Optional post-filter; return false to reject a candidate match. */
  accept?: (m: RegExpExecArray) => boolean;
  /** Optional: which capture group holds the sensitive value (default 0). */
  group?: number;
}

// --- Luhn check for card numbers, to cut false positives on long digit runs ---
function luhnValid(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const DETECTORS: Detector[] = [
  // Secrets / API keys — highest priority; these get blocked, not tokenized.
  {
    type: "SECRET",
    priority: 100,
    regex: /\bsk-[A-Za-z0-9][A-Za-z0-9\-_]{6,}\b/g,
  },
  {
    type: "SECRET",
    priority: 100,
    regex: /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  },
  {
    type: "SECRET",
    priority: 99,
    // labelled secrets: INTERNAL_API_KEY=..., api_key: "...", token=...
    regex: /\b(?:INTERNAL_API_KEY|API_KEY|SECRET|TOKEN|PASSWORD)\b\s*[:=]\s*["']?([^\s"',}]{6,})/gi,
    group: 1,
  },
  // Credit card (Luhn-validated).
  {
    type: "CREDIT_CARD",
    priority: 90,
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    accept: (m) => luhnValid(m[0]),
  },
  // Aadhaar — 12 digits, optionally grouped 4-4-4.
  {
    type: "AADHAAR",
    priority: 80,
    regex: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g,
    accept: (m) => m[0].replace(/\D/g, "").length === 12,
  },
  // Indian PAN.
  {
    type: "PAN",
    priority: 75,
    regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
  },
  // Email.
  {
    type: "EMAIL",
    priority: 70,
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  },
  // Indian mobile number, optional +91 / 0 prefix, optional 5-5 grouping.
  {
    type: "PHONE",
    priority: 60,
    regex: /(?:\+?91[\-\s]?|0)?[6-9]\d{4}[\s\-]?\d{5}\b/g,
    accept: (m) => {
      const d = m[0].replace(/\D/g, "");
      return d.length === 10 || (d.length === 12 && d.startsWith("91"));
    },
  },
  // Insurance id — labelled (health scenario).
  {
    type: "INSURANCE_ID",
    priority: 55,
    regex: /\b(?:insurance(?:\s*id)?|policy(?:\s*(?:no|number|id))?|member\s*id)\b\s*[:#]?\s*([A-Z]{1,4}\d{5,12})/gi,
    group: 1,
  },
  // Date of birth / dates.
  {
    type: "DOB",
    priority: 40,
    regex: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})\b/g,
  },
  // Names — label-driven to keep precision high (free-text NER is out of scope).
  // No `i` flag: the keyword uses explicit case classes so the captured name
  // stays genuinely capitalized (an `i` flag would let [A-Z] match lowercase).
  {
    type: "NAME",
    priority: 30,
    regex: /\b(?:[Nn]ame|[Pp]atient|[Cc]ustomer|[Hh]older|[Aa]ccount\s*[Hh]older|I\s*am|I'?m|Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\b[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g,
    group: 1,
  },
];

/** Extra names to detect verbatim (seeded from canned scenario data). */
let nameGazetteer: string[] = [];
export function seedNameGazetteer(names: string[]): void {
  nameGazetteer = Array.from(new Set(names.filter((n) => n && n.trim().length > 1)));
}

function overlaps(a: PiiSpan, b: PiiSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Detect all PII spans in `text`. Overlapping matches resolve to the
 * highest-priority detector; ties resolve to the longer match.
 */
export function detect(text: string): PiiSpan[] {
  const candidates: Array<PiiSpan & { priority: number }> = [];

  for (const det of DETECTORS) {
    det.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = det.regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        det.regex.lastIndex++;
        continue;
      }
      if (det.accept && !det.accept(m)) continue;
      const gi = det.group ?? 0;
      const value = m[gi];
      if (!value) continue;
      // Locate the group within the full match for accurate offsets.
      const groupStart = gi === 0 ? m.index : m.index + m[0].indexOf(value);
      candidates.push({
        type: det.type,
        value,
        start: groupStart,
        end: groupStart + value.length,
        priority: det.priority,
      });
    }
  }

  // Gazetteer names (exact, case-insensitive, word-boundary-ish).
  for (const name of nameGazetteer) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      candidates.push({
        type: "NAME",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        priority: 35,
      });
    }
  }

  // Resolve overlaps: sort by priority desc, then length desc, then start asc.
  candidates.sort(
    (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );

  const kept: PiiSpan[] = [];
  for (const c of candidates) {
    if (kept.some((k) => overlaps(k, c))) continue;
    kept.push({ type: c.type, value: c.value, start: c.start, end: c.end });
  }

  kept.sort((a, b) => a.start - b.start);
  return kept;
}
