// Policy engine. The authoritative intent lives in the pre-written Cedar files
// under server/policies/*.cedar (shown to judges for authenticity). This engine
// mirrors those rules and is what actually runs per egress, keyed by policy_id.

import type { PiiSpan, ScenarioId, Verdict } from "../types.js";

export interface PolicyDecision {
  verdict: Verdict;
  policy_id: string;
  reason: string;
}

// Destinations the agent is allowed to reach at all.
const DESTINATION_ALLOWLIST = new Set(["crm_lookup", "send_email", "http_post"]);

// For http_post, only these hosts are permitted egress targets.
const HOST_ALLOWLIST = new Set([
  "audit.internal",
  "triage.internal",
  "localhost",
  "127.0.0.1",
]);

function hostOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "url" in payload) {
    const url = String((payload as Record<string, unknown>).url ?? "");
    try {
      return new URL(url).hostname;
    } catch {
      const m = url.match(/^[a-z]+:\/\/([^/]+)/i);
      return m ? m[1] : null;
    }
  }
  return null;
}

const PII_POLICY_ID: Record<ScenarioId, string> = {
  fintech: "fintech.pii.tokenize",
  health: "health.phi.tokenize",
  freeform: "default.pii.tokenize",
};

/**
 * Evaluate egress. Order matters — it mirrors the deny-overrides semantics of
 * the Cedar policy set: secret exfiltration and destination violations are hard
 * blocks; PII present triggers tokenize/redact; otherwise allow.
 */
export function evaluate(
  destination: string,
  payload: unknown,
  spans: PiiSpan[],
  scenario: ScenarioId,
): PolicyDecision {
  const hasSecret = spans.some((s) => s.type === "SECRET");

  // 1. Unknown tool destination -> hard block.
  if (!DESTINATION_ALLOWLIST.has(destination)) {
    return {
      verdict: "block",
      policy_id: "egress.destination.allowlist",
      reason: `Destination tool "${destination}" is not in the egress allowlist.`,
    };
  }

  // 2. Secret pattern in the payload -> hard block + redact (exfil attempt).
  if (hasSecret) {
    return {
      verdict: "block",
      policy_id: "secret.exfil.block",
      reason:
        "Secret / API-key pattern detected in egress payload. Call blocked and secret redacted from the evidence record.",
    };
  }

  // 3. http_post to a non-allowlisted host -> hard block.
  if (destination === "http_post") {
    const host = hostOf(payload);
    if (host && !HOST_ALLOWLIST.has(host)) {
      return {
        verdict: "block",
        policy_id: "egress.destination.allowlist",
        reason: `Destination host "${host}" is not in the egress allowlist (${[...HOST_ALLOWLIST].join(", ")}).`,
      };
    }
  }

  // 4. PII present but destination trusted -> tokenize / redact and allow through.
  if (spans.length > 0) {
    const types = Array.from(new Set(spans.map((s) => s.type)));
    return {
      verdict: "redact",
      policy_id: PII_POLICY_ID[scenario],
      reason: `Tokenized before egress: ${types.join(", ")}. Destination in allowlist.`,
    };
  }

  // 5. Nothing sensitive -> allow untouched.
  return {
    verdict: "allow",
    policy_id: "egress.default.allow",
    reason: "No PII or secrets detected; destination in allowlist.",
  };
}
