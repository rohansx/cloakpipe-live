// Mirror of the server's public types (kept in sync by hand — small surface).

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

export interface PiiSpan {
  type: PiiType;
  value: string;
  start: number;
  end: number;
}

export interface Transform {
  type: PiiType;
  action: "tokenize" | "redact";
  original: string;
  replacement: string;
}

export interface RawEgress {
  destination: string;
  display: string;
  spans: PiiSpan[];
  payload: unknown;
}

export interface SanitizedEgress {
  destination: string;
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

export interface VerifyResult {
  ok: boolean;
  checked: number;
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

// ---- UI timeline model ----

export interface EgressItem {
  kind: "egress";
  id: string;
  destination: string;
  raw?: RawEgress;
  verdict?: Verdict;
  policy_id?: string;
  reason?: string;
  sanitized?: SanitizedEgress;
  ledger?: LedgerEntry;
  blocked?: boolean;
  echoed?: unknown;
  echoReady?: boolean;
}

export interface ThoughtItem {
  kind: "thought";
  id: string;
  text: string;
}

export type TimelineItem = EgressItem | ThoughtItem;
