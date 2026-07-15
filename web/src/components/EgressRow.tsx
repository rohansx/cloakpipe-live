import { useState } from "react";
import type { EgressItem } from "../types";
import { highlightPii, highlightTokens } from "../lib/highlight";
import { VerdictBadge } from "./Badge";

function DestTag({ name }: { name: string }) {
  return (
    <span className="mono rounded bg-[--color-ink-700] px-1.5 py-0.5 text-[11px] text-[--color-cyan]">
      mcp:{name}
    </span>
  );
}

export function EgressRow({ item }: { item: EgressItem }) {
  const [showEcho, setShowEcho] = useState(false);
  const blocked = item.blocked;

  return (
    <div className="card-appear grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* LEFT — what the agent tried to send */}
      <div className="rounded-lg border border-[--color-line] bg-[--color-ink-850]/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <DestTag name={item.destination} />
          <span className="text-[10px] uppercase tracking-widest text-[--color-fog-500]">tried to send</span>
        </div>
        <pre className="mono max-h-72 overflow-auto whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[--color-fog-300]">
          {item.raw ? highlightPii(item.raw.display, item.raw.spans) : "…"}
        </pre>
        {item.raw && item.raw.spans.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from(new Set(item.raw.spans.map((s) => s.type))).map((t) => (
              <span key={t} className="rounded bg-[--color-leak-soft] px-1.5 py-0.5 text-[10px] text-[#ffb3ba]">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT — what actually left the network */}
      <div
        className={`relative rounded-lg border p-3 ${
          blocked
            ? "border-[rgba(255,92,108,0.4)] bg-[rgba(255,92,108,0.05)]"
            : "border-[--color-line] bg-[--color-ink-850]/80"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          {item.verdict ? <VerdictBadge verdict={item.verdict} /> : <span className="text-[--color-fog-500]">…</span>}
          <span className="text-[10px] uppercase tracking-widest text-[--color-fog-500]">left the wire</span>
        </div>

        {blocked ? (
          <div className="py-2">
            <pre className="mono max-h-40 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[--color-fog-500] line-through decoration-[rgba(255,92,108,0.7)]">
              {item.sanitized?.display}
            </pre>
            <div className="mt-2 rounded border border-[rgba(255,92,108,0.4)] bg-[rgba(255,92,108,0.08)] px-2.5 py-2 text-[12px] text-[#ffc4ca]">
              <span className="font-semibold">Blocked — nothing sent.</span> {item.reason}
            </div>
          </div>
        ) : (
          <>
            <pre className="mono max-h-72 overflow-auto whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[--color-fog-300]">
              {item.sanitized ? highlightTokens(item.sanitized.display, item.sanitized.transforms) : "…"}
            </pre>
            {item.reason && <p className="mt-2 text-[11.5px] text-[--color-fog-400]">{item.reason}</p>}
          </>
        )}

        {/* Downstream echo — proof the tool only ever saw the sanitized bytes. */}
        {!blocked && item.echoReady && (
          <div className="mt-3 border-t border-[--color-line] pt-2">
            <button
              onClick={() => setShowEcho((v) => !v)}
              className="text-[11px] font-medium text-[--color-cyan] hover:underline"
            >
              {showEcho ? "▾ hide" : "▸ show"} what {item.destination} actually received
            </button>
            {showEcho && (
              <pre className="mono mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded bg-[--color-ink-900] p-2 text-[12px] text-[--color-token]">
                {JSON.stringify(item.echoed, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
