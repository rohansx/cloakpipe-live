import { useState } from "react";
import type { LedgerEntry, VerifyResult } from "../types";
import { VerdictBadge } from "./Badge";

function shortHash(h: string): string {
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

interface Props {
  entries: LedgerEntry[];
  verify: VerifyResult | null;
  onVerify: () => void;
  onTamper: (seq: number, value: string) => void;
  busy: boolean;
}

export function Ledger({ entries, verify, onVerify, onTamper, busy }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const entryState = (seq: number) => verify?.entries.find((e) => e.seq === seq);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[--color-line] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[--color-fog-100]">Evidence ledger</span>
          <span className="mono text-[11px] text-[--color-fog-500]">hash-chained · append-only</span>
          {verify &&
            (verify.ok ? (
              <span className="ml-1 rounded-full border border-[rgba(53,224,161,0.4)] bg-[rgba(53,224,161,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[--color-token]">
                ✓ chain intact ({verify.checked})
              </span>
            ) : (
              <span className="ml-1 rounded-full border border-[rgba(255,92,108,0.45)] bg-[rgba(255,92,108,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[--color-block]">
                ✗ chain broken at #{verify.brokenSeq}
              </span>
            ))}
        </div>
        <button
          onClick={onVerify}
          disabled={busy || entries.length === 0}
          className="rounded-md border border-[--color-cyan]/40 bg-[--color-cyan]/10 px-3 py-1 text-[12px] font-semibold text-[--color-cyan] transition hover:bg-[--color-cyan]/20 disabled:opacity-40"
        >
          Verify chain
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-[--color-fog-500]">
            No entries yet. Every egress the agent attempts appends one tamper-evident row here.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[--color-ink-900] text-[10px] uppercase tracking-wider text-[--color-fog-500]">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">action</th>
                <th className="px-3 py-2 font-medium">verdict</th>
                <th className="px-3 py-2 font-medium">policy</th>
                <th className="px-3 py-2 font-medium">prev_hash</th>
                <th className="px-3 py-2 font-medium">payload_hash</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const st = entryState(e.seq);
                const broken = st && !st.ok;
                return (
                  <tr
                    key={e.seq}
                    className={`row-appear border-t border-[--color-line] align-top ${
                      broken ? "bg-[rgba(255,92,108,0.08)]" : "hover:bg-[--color-ink-850]/60"
                    }`}
                  >
                    <td className="mono px-3 py-2 text-[--color-fog-500]">{e.seq}</td>
                    <td className="mono px-3 py-2 text-[--color-fog-300]">{e.action}</td>
                    <td className="px-3 py-2">
                      <VerdictBadge verdict={e.verdict} small />
                    </td>
                    <td className="mono px-3 py-2 text-[--color-fog-400]">{e.policy_id}</td>
                    <td className="mono px-3 py-2 text-[--color-fog-500]">{shortHash(e.prev_hash)}</td>
                    <td className="px-3 py-2">
                      {editing === e.seq ? (
                        <span className="flex items-center gap-1">
                          <input
                            value={draft}
                            onChange={(ev) => setDraft(ev.target.value)}
                            className="mono w-40 rounded border border-[--color-cyan]/50 bg-[--color-ink-900] px-1.5 py-0.5 text-[11px] text-[--color-fog-100] outline-none"
                          />
                          <button
                            onClick={() => {
                              onTamper(e.seq, draft);
                              setEditing(null);
                            }}
                            className="text-[11px] font-semibold text-[--color-block]"
                          >
                            forge
                          </button>
                          <button onClick={() => setEditing(null)} className="text-[11px] text-[--color-fog-500]">
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span
                          onClick={() => {
                            setEditing(e.seq);
                            setDraft(e.payload_hash);
                          }}
                          title="Click to forge this hash (tamper demo)"
                          className={`mono cursor-pointer rounded px-1 hover:bg-[rgba(255,92,108,0.15)] ${
                            broken ? "text-[--color-block]" : "text-[--color-fog-400]"
                          }`}
                        >
                          {shortHash(e.payload_hash)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {st &&
                        (st.ok ? (
                          <span className="text-[--color-token]" title="hash verified">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[--color-block]" title={st.reason}>
                            ✗
                          </span>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {entries.length > 0 && (
        <div className="border-t border-[--color-line] px-4 py-1.5 text-[11px] text-[--color-fog-500]">
          Tip: click a <span className="mono text-[--color-fog-300]">payload_hash</span> to forge it, then re-run{" "}
          <span className="text-[--color-cyan]">Verify chain</span> — the tamper turns the row red.
        </div>
      )}
    </div>
  );
}
