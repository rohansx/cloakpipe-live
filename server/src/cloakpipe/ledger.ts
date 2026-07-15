// Append-only, hash-chained evidence ledger. Every egress decision writes one
// entry whose hash commits to the previous entry's hash, so any retroactive edit
// breaks the chain from that point forward — the "flight recorder" guarantee.

import { createHash } from "node:crypto";
import type { LedgerEntry, Verdict, VerifyResult } from "../types.js";

const GENESIS = "0".repeat(64);

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Canonical hash of an entry's committed fields. Order is fixed and explicit. */
function computeEntryHash(e: Omit<LedgerEntry, "entry_hash">): string {
  const canonical = [
    e.seq,
    e.ts,
    e.action,
    e.verdict,
    e.policy_id,
    e.payload_hash,
    e.prev_hash,
  ].join("|");
  return sha256(canonical);
}

export function hashPayload(payload: unknown): string {
  return sha256(JSON.stringify(payload ?? null));
}

export class Ledger {
  private entries: LedgerEntry[] = [];

  append(input: {
    action: string;
    verdict: Verdict;
    policy_id: string;
    reason: string;
    payload_hash: string;
    ts?: string;
  }): LedgerEntry {
    const seq = this.entries.length + 1;
    const prev_hash = this.entries.length ? this.entries[this.entries.length - 1].entry_hash : GENESIS;
    const base: Omit<LedgerEntry, "entry_hash"> = {
      seq,
      ts: input.ts ?? new Date().toISOString(),
      action: input.action,
      verdict: input.verdict,
      policy_id: input.policy_id,
      reason: input.reason,
      payload_hash: input.payload_hash,
      prev_hash,
    };
    const entry: LedgerEntry = { ...base, entry_hash: computeEntryHash(base) };
    this.entries.push(entry);
    return entry;
  }

  all(): LedgerEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  reset(): void {
    this.entries = [];
  }

  /**
   * Recompute the chain from genesis. An entry fails if its own hash doesn't
   * match its committed fields, or if it doesn't point at the real previous hash.
   */
  verify(): VerifyResult {
    const results: VerifyResult["entries"] = [];
    let brokenSeq: number | null = null;
    let expectedPrev = GENESIS;

    for (const e of this.entries) {
      const { entry_hash, ...base } = e;
      const recomputed = computeEntryHash(base);
      let ok = true;
      let reason: string | undefined;

      if (e.prev_hash !== expectedPrev) {
        ok = false;
        reason = "prev_hash does not match the previous entry's hash (chain link broken).";
      } else if (recomputed !== entry_hash) {
        ok = false;
        reason = "entry_hash does not match its committed contents (entry was tampered).";
      }

      if (!ok && brokenSeq === null) brokenSeq = e.seq;
      results.push({ seq: e.seq, ok, reason });
      expectedPrev = e.entry_hash; // continue against the stored (possibly tampered) hash
    }

    return {
      ok: brokenSeq === null,
      checked: this.entries.length,
      brokenSeq,
      entries: results,
    };
  }

  /**
   * DEMO ONLY: mutate a committed field of a past entry *without* recomputing its
   * hash. This is how the tamper demo forges history — verify() then goes red.
   */
  tamper(seq: number, field: "action" | "verdict" | "reason" | "payload_hash", value: string): boolean {
    const e = this.entries.find((x) => x.seq === seq);
    if (!e) return false;
    (e as unknown as Record<string, string>)[field] = value;
    return true;
  }
}

export const ledger = new Ledger();
