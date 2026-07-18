import type { LedgerEntry, ScenarioId, ScenarioMeta, StreamEvent, VerifyResult } from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function fetchScenarios(): Promise<{ scenarios: ScenarioMeta[]; agent: string }> {
  return json(await fetch("/api/scenarios"));
}

export async function resetLedger(): Promise<void> {
  await fetch("/api/ledger/reset", { method: "POST" });
}

export async function fetchLedger(): Promise<LedgerEntry[]> {
  const { entries } = await json<{ entries: LedgerEntry[] }>(await fetch("/api/ledger"));
  return entries;
}

export async function verifyLedger(): Promise<VerifyResult> {
  return json(await fetch("/api/ledger/verify", { method: "POST" }));
}

export async function tamperLedger(
  seq: number,
  field: "action" | "verdict" | "reason" | "payload_hash",
  value: string,
): Promise<{ ok: boolean; entries: LedgerEntry[] }> {
  return json(
    await fetch("/api/ledger/tamper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seq, field, value }),
    }),
  );
}

/**
 * Start a run and stream its events over SSE (native EventSource). Returns a
 * disposer that closes the stream. Calls `onEvent` for each event and `onClose`
 * when the run finishes or errors.
 */
export async function runScenario(
  params: { scenario: ScenarioId; redteam: boolean; prompt: string },
  onEvent: (e: StreamEvent) => void,
  onClose: () => void,
): Promise<() => void> {
  const { runId } = await json<{ runId: string }>(
    await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    }),
  );

  const es = new EventSource(`/api/stream?runId=${encodeURIComponent(runId)}`);
  es.onmessage = (ev) => {
    try {
      const e = JSON.parse(ev.data) as StreamEvent;
      onEvent(e);
      if (e.kind === "run_done" || e.kind === "error") {
        es.close();
        onClose();
      }
    } catch {
      /* ignore malformed frames */
    }
  };
  es.onerror = () => {
    es.close();
    onClose();
  };
  return () => es.close();
}
