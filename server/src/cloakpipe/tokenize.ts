// Deterministic, format-preserving-ish tokenization. The same value always maps
// to the same token (referential integrity across tool calls), and the token is
// derived from a keyed hash so it can't be reversed without the vault.

import { createHmac } from "node:crypto";
import type { PiiType } from "../types.js";

const VAULT_KEY = process.env.CLOAKPIPE_VAULT_KEY ?? "cloakpipe-live-demo-key";

const PREFIX: Record<PiiType, string> = {
  EMAIL: "TOK_EMAIL",
  PHONE: "TOK_PHONE",
  PAN: "TOK_PAN",
  AADHAAR: "TOK_AADHAAR",
  CREDIT_CARD: "TOK_CARD",
  NAME: "TOK_NAME",
  DOB: "TOK_DOB",
  INSURANCE_ID: "TOK_INSID",
  SECRET: "REDACTED_SECRET",
};

// In-memory vault: token -> original. Never leaves the trust layer.
const vault = new Map<string, string>();

function digest(type: PiiType, value: string): string {
  return createHmac("sha256", VAULT_KEY).update(`${type}:${value}`).digest("hex");
}

/** Produce a stable token for a detected value. */
export function tokenize(type: PiiType, value: string): string {
  const token = `${PREFIX[type]}_${digest(type, value).slice(0, 8)}`;
  vault.set(token, value);
  return token;
}

/** Secrets are redacted, not tokenized — the original is never retained. */
export function redact(type: PiiType, _value: string): string {
  if (type === "SECRET") return "[REDACTED_SECRET]";
  return `[REDACTED_${type}]`;
}

/** For demo/debug only: look up what a token stands for. */
export function reveal(token: string): string | undefined {
  return vault.get(token);
}
