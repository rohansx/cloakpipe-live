import { useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { Ledger } from "./components/Ledger";
import { Timeline } from "./components/Timeline";
import {
  fetchLedger,
  fetchScenarios,
  resetLedger,
  runScenario,
  tamperLedger,
  verifyLedger,
} from "./lib/api";
import type {
  EgressItem,
  LedgerEntry,
  ScenarioId,
  ScenarioMeta,
  StreamEvent,
  TimelineItem,
  VerifyResult,
} from "./types";

export default function App() {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [agent, setAgent] = useState<string>("scripted");
  const [active, setActive] = useState<ScenarioId>("fintech");
  const [prompt, setPrompt] = useState("");
  const [redteam, setRedteam] = useState(false);
  const [running, setRunning] = useState(false);

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const thoughtSeq = useRef(0);

  useEffect(() => {
    fetchScenarios()
      .then(({ scenarios, agent }) => {
        setScenarios(scenarios);
        setAgent(agent);
        const f = scenarios.find((s) => s.id === "fintech") ?? scenarios[0];
        if (f) {
          setActive(f.id);
          setPrompt(f.defaultPrompt);
        }
      })
      .catch(() => void 0);
  }, []);

  const activeMeta = useMemo(() => scenarios.find((s) => s.id === active), [scenarios, active]);

  function selectScenario(id: ScenarioId) {
    setActive(id);
    const s = scenarios.find((x) => x.id === id);
    if (s) setPrompt(s.defaultPrompt);
    if (!s?.supportsRedteam) setRedteam(false);
  }

  // Auto-scroll the timeline as events stream in.
  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  function applyEvent(e: StreamEvent) {
    if (e.kind === "run_started") {
      setAgent(e.agent);
    } else if (e.kind === "agent_thought") {
      const id = `t${thoughtSeq.current++}`;
      setItems((prev) => [...prev, { kind: "thought", id, text: e.text }]);
    } else if (e.kind === "agent_tool_call") {
      const it: EgressItem = { kind: "egress", id: e.id, destination: e.destination, raw: e.raw };
      setItems((prev) => [...prev, it]);
    } else if (e.kind === "egress_verdict") {
      setItems((prev) =>
        prev.map((p) =>
          p.kind === "egress" && p.id === e.id
            ? {
                ...p,
                verdict: e.verdict,
                policy_id: e.policy_id,
                reason: e.reason,
                sanitized: e.sanitized,
                ledger: e.ledger,
                blocked: e.blocked,
              }
            : p,
        ),
      );
      setLedger((prev) => [...prev, e.ledger]);
      setVerify(null);
    } else if (e.kind === "tool_result") {
      setItems((prev) =>
        prev.map((p) =>
          p.kind === "egress" && p.id === e.id ? { ...p, echoed: e.echoed, echoReady: true } : p,
        ),
      );
    } else if (e.kind === "agent_final") {
      const id = `t${thoughtSeq.current++}`;
      setItems((prev) => [...prev, { kind: "thought", id, text: `✓ ${e.text}` }]);
    }
  }

  async function run() {
    setRunning(true);
    setItems([]);
    setLedger([]);
    setVerify(null);
    thoughtSeq.current = 0;
    try {
      await resetLedger();
      await runScenario({ scenario: active, redteam, prompt }, applyEvent, () => setRunning(false));
    } catch {
      setRunning(false);
    }
  }

  function reset() {
    setItems([]);
    setLedger([]);
    setVerify(null);
    resetLedger().catch(() => void 0);
  }

  async function onVerify() {
    setBusy(true);
    try {
      setVerify(await verifyLedger());
    } finally {
      setBusy(false);
    }
  }

  async function onTamper(seq: number, value: string) {
    setBusy(true);
    try {
      await tamperLedger(seq, "payload_hash", value);
      setLedger(await fetchLedger());
      setVerify(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-[1600px] flex-col gap-3 p-3 lg:p-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[--color-line] bg-[--color-ink-900]/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[--color-cyan]/30 to-[--color-token]/20 text-lg">
            🛡️
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight text-[--color-fog-100]">
              CloakPipe <span className="text-[--color-cyan]">Live</span>
            </h1>
            <p className="text-[11.5px] text-[--color-fog-500]">
              A glass box for AI agents — what it tried to leak vs. what actually left the wire.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-[--color-line] bg-[--color-ink-850] px-2.5 py-1 text-[--color-fog-400]">
            agent runtime: <span className="mono text-[--color-fog-100]">{agent}</span>
          </span>
          <span className="rounded-full border border-[rgba(53,224,161,0.3)] bg-[rgba(53,224,161,0.08)] px-2.5 py-1 text-[--color-token]">
            trust layer: CloakPipe
          </span>
        </div>
      </header>

      {/* Main grid: controls | split-screen ; ledger spans full width below */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[360px_1fr]">
        <aside className="min-h-0 overflow-auto rounded-xl border border-[--color-line] bg-[--color-ink-900]/60 p-4">
          <Controls
            scenarios={scenarios}
            active={active}
            onSelect={selectScenario}
            prompt={prompt}
            onPrompt={setPrompt}
            redteam={redteam && (activeMeta?.supportsRedteam ?? false)}
            onRedteam={setRedteam}
            running={running}
            onRun={run}
            onReset={reset}
          />
        </aside>

        <main
          ref={timelineRef}
          className="min-h-0 overflow-auto rounded-xl border border-[--color-line] bg-[--color-ink-900]/40 p-4"
        >
          <Timeline items={items} agent={agent} />
        </main>
      </div>

      {/* Evidence ledger */}
      <section className="h-[34vh] min-h-[220px] overflow-hidden rounded-xl border border-[--color-line] bg-[--color-ink-900]/70">
        <Ledger entries={ledger} verify={verify} onVerify={onVerify} onTamper={onTamper} busy={busy} />
      </section>
    </div>
  );
}
