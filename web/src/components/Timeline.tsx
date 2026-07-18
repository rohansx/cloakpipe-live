import type { TimelineItem } from "../types";
import { EgressRow } from "./EgressRow";

export function Timeline({ items, agent }: { items: TimelineItem[]; agent: string }) {
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
        <div className="text-4xl">🛡️</div>
        <p className="max-w-md text-[--color-fog-400]">
          Pick a scenario and hit <span className="text-[--color-fog-100]">Run agent</span>. The left column shows what
          the agent tried to send; the right shows what CloakPipe actually let out.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* column headers */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-[rgba(255,92,108,0.25)] bg-[rgba(255,92,108,0.06)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#ff9aa4]">
          ← What the agent tried to send
        </div>
        <div className="rounded-md border border-[rgba(53,224,161,0.25)] bg-[rgba(53,224,161,0.05)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[--color-token]">
          What actually left your network →
        </div>
      </div>

      {items.map((item) =>
        item.kind === "thought" ? (
          <div key={item.id} className="card-appear flex items-start gap-2 px-1 text-[13px] text-[--color-fog-400]">
            <span className="mt-0.5 select-none text-[--color-cyan]">▸</span>
            <span>
              <span className="mono mr-2 text-[10px] uppercase tracking-wider text-[--color-fog-500]">{agent}</span>
              {item.text}
            </span>
          </div>
        ) : (
          <EgressRow key={item.id} item={item} />
        ),
      )}
    </div>
  );
}
