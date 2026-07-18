// Shared types for the CloakPipe Live orchestrator + trust layer.

export type Verdict = "allow" | "redact" | "block";

export type PiiType =
  | "EMAIL"
  | "PHONE"
  | "PAN"
  | "AADHAAR"
  | "CREDIT_CARD"
  | "NAME"
  | "ADDRESS"
  | "LOCATION"
  | "ORG"
  | "DOB"
  | "INSURANCE_ID"
  | "SECRET";

/** A detected span of PII within a rendered string. Offsets index into `display`. */
export interface PiiSpan {
  type: PiiType;
  value: string;
  start: number;
  end: number;
}

/** A single transform CloakPipe applied to a detected value. */
export interface Transform {
  type: PiiType;
  action: "tokenize" | "redact";
  original: string;
  replacement: string;
}

/** The payload the agent *tried* to send, exactly as emitted. */
export interface RawEgress {
  destination: string;
  /** Pretty-printed JSON of the payload the agent emitted. */
  display: string;
  /** PII detected inside `display` (offsets index into `display`). */
  spans: PiiSpan[];
  payload: unknown;
}

/** The payload CloakPipe actually let out. */
export interface SanitizedEgress {
  destination: string;
  /** Pretty-printed JSON of the payload after tokenize/redact. */
  display: string;
  transforms: Transform[];
  payload: unknown;
}

export interface LedgerEntry {
  seq: number;
  ts: string;
  action: string;
  verdict: Verdict;
  policy_id: string;
  reason: string;
  payload_hash: string;
  prev_hash: string;
  entry_hash: string;
}

/** The structured per-egress event CloakPipe emits (spec §4). */
export interface EgressResult {
  id: string;
  raw: RawEgress;
  sanitized: SanitizedEgress;
  verdict: Verdict;
  policy_id: string;
  reason: string;
  ledger: LedgerEntry;
  /** True when the destination call was suppressed (verdict === "block"). */
  blocked: boolean;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  /** seq of the first entry whose hash-chain integrity fails, or null. */
  brokenSeq: number | null;
  entries: Array<{ seq: number; ok: boolean; reason?: string }>;
}

export type ScenarioId = "fintech" | "health" | "freeform";

export interface ScenarioMeta {
  id: ScenarioId;
  title: string;
  blurb: string;
  compliance: string;
  defaultPrompt: string;
  supportsRedteam: boolean;
}

// ---- SSE event envelope streamed to the browser ----

export type StreamEvent =
  | { kind: "run_started"; runId: string; scenario: ScenarioId; redteam: boolean; agent: "openai" | "scripted" }
  | { kind: "agent_thought"; text: string }
  | { kind: "agent_tool_call"; id: string; destination: string; raw: RawEgress }
  | {
      kind: "egress_verdict";
      id: string;
      verdict: Verdict;
      policy_id: string;
      reason: string;
      sanitized: SanitizedEgress;
      ledger: LedgerEntry;
      blocked: boolean;
    }
  | { kind: "tool_result"; id: string; destination: string; echoed: unknown; blocked: boolean }
  | { kind: "agent_final"; text: string }
  | { kind: "run_done" }
  | { kind: "error"; message: string };
