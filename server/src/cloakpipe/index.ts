// CloakPipe adapter — the spec §4 surface. Given a destination + the payload an
// agent tried to send, it returns the raw view, the sanitized view, a policy
// verdict, and the ledger entry it appended. This is the single seam the rest of
// the app talks to; swapping the embedded engine for the real CloakPipe (Rust)
// service would mean re-implementing only this module.

import { randomUUID } from "node:crypto";
import type { EgressResult, PiiSpan, SanitizedEgress, Transform } from "../types.js";
import type { ScenarioId } from "../types.js";
import { detect } from "./detectors.js";
import { evaluate } from "./policy.js";
import { hashPayload, ledger } from "./ledger.js";
import { redact, tokenize } from "./tokenize.js";

function render(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

/** Apply transforms to the rendered string, right-to-left so offsets stay valid. */
function applyTransforms(display: string, spans: PiiSpan[]): { text: string; transforms: Transform[] } {
  const transforms: Transform[] = [];
  const ordered = [...spans].sort((a, b) => b.start - a.start);
  let text = display;
  for (const s of ordered) {
    const action: Transform["action"] = s.type === "SECRET" ? "redact" : "tokenize";
    const replacement = action === "redact" ? redact(s.type, s.value) : tokenize(s.type, s.value);
    text = text.slice(0, s.start) + replacement + text.slice(s.end);
    transforms.push({ type: s.type, action, original: s.value, replacement });
  }
  transforms.reverse(); // back to document order
  return { text, transforms };
}

function reparse(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Process one egress. `blocked` results still produce a full raw+sanitized view
 * and a ledger entry — the blocked attempt is itself evidence.
 */
export function processEgress(
  destination: string,
  payload: unknown,
  scenario: ScenarioId,
): EgressResult {
  const rawDisplay = render(payload);
  const spans = detect(rawDisplay);
  const decision = evaluate(destination, payload, spans, scenario);

  const { text: sanitizedDisplay, transforms } = applyTransforms(rawDisplay, spans);
  const sanitized: SanitizedEgress = {
    destination,
    display: sanitizedDisplay,
    transforms,
    payload: reparse(sanitizedDisplay, payload),
  };

  // The ledger commits to the hash of what CloakPipe *allowed out*. For a block,
  // that's the redacted payload — the raw secret never enters the record.
  const payload_hash = hashPayload(sanitized.payload);
  const entry = ledger.append({
    action: `egress:${destination}`,
    verdict: decision.verdict,
    policy_id: decision.policy_id,
    reason: decision.reason,
    payload_hash,
  });

  return {
    id: randomUUID(),
    raw: { destination, display: rawDisplay, spans, payload },
    sanitized,
    verdict: decision.verdict,
    policy_id: decision.policy_id,
    reason: decision.reason,
    ledger: entry,
    blocked: decision.verdict === "block",
  };
}

export { ledger } from "./ledger.js";
export { seedNameGazetteer } from "./detectors.js";
