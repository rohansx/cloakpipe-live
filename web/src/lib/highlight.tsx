import type { ReactNode } from "react";
import type { PiiSpan, Transform } from "../types";

/** Render `display` with PII spans wrapped in a red highlight. */
export function highlightPii(display: string, spans: PiiSpan[]): ReactNode[] {
  if (!spans.length) return [display];
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((s, i) => {
    if (s.start < cursor) return; // skip overlaps defensively
    if (s.start > cursor) out.push(display.slice(cursor, s.start));
    out.push(
      <span key={`p${i}`} className="pii" title={`${s.type} — flagged as PII`}>
        {display.slice(s.start, s.end)}
      </span>,
    );
    cursor = s.end;
  });
  if (cursor < display.length) out.push(display.slice(cursor));
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Render `display` with token/redaction replacements highlighted green/amber. */
export function highlightTokens(display: string, transforms: Transform[]): ReactNode[] {
  if (!transforms.length) return [display];
  const byRepl = new Map<string, Transform>();
  for (const t of transforms) byRepl.set(t.replacement, t);
  const uniques = [...byRepl.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${uniques.map(escapeRe).join("|")})`, "g");

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(display)) !== null) {
    if (m.index > last) out.push(display.slice(last, m.index));
    const t = byRepl.get(m[0]);
    out.push(
      <span
        key={`t${i++}`}
        className={`tok${t?.action === "redact" ? " redacted" : ""}`}
        title={t ? `${t.type} — ${t.action}d before egress` : undefined}
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < display.length) out.push(display.slice(last));
  return out;
}
