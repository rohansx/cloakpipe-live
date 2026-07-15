import type { Verdict } from "../types";

const STYLES: Record<Verdict, { label: string; cls: string; dot: string }> = {
  allow: {
    label: "ALLOW",
    cls: "text-[--color-token] border-[rgba(53,224,161,0.4)] bg-[rgba(53,224,161,0.08)]",
    dot: "bg-[--color-token]",
  },
  redact: {
    label: "REDACT",
    cls: "text-[--color-warn] border-[rgba(255,180,84,0.4)] bg-[rgba(255,180,84,0.08)]",
    dot: "bg-[--color-warn]",
  },
  block: {
    label: "BLOCK",
    cls: "text-[--color-block] border-[rgba(255,92,108,0.45)] bg-[rgba(255,92,108,0.1)]",
    dot: "bg-[--color-block]",
  },
};

export function VerdictBadge({ verdict, small }: { verdict: Verdict; small?: boolean }) {
  const s = STYLES[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${s.cls} ${
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
