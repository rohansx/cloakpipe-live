import type { ScenarioId, ScenarioMeta } from "../types";

interface Props {
  scenarios: ScenarioMeta[];
  active: ScenarioId;
  onSelect: (id: ScenarioId) => void;
  prompt: string;
  onPrompt: (v: string) => void;
  redteam: boolean;
  onRedteam: (v: boolean) => void;
  running: boolean;
  onRun: () => void;
  onReset: () => void;
}

export function Controls(props: Props) {
  const active = props.scenarios.find((s) => s.id === props.active);
  const canRedteam = active?.supportsRedteam ?? false;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {props.scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => props.onSelect(s.id)}
            disabled={props.running}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition disabled:opacity-50 ${
              props.active === s.id
                ? "border-[--color-cyan]/50 bg-[--color-cyan]/10 text-[--color-fog-100]"
                : "border-[--color-line] bg-[--color-ink-850] text-[--color-fog-400] hover:text-[--color-fog-100]"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {active && (
        <p className="text-[12px] leading-relaxed text-[--color-fog-400]">
          {active.blurb}{" "}
          <span className="text-[--color-fog-500]">Compliance: {active.compliance}</span>
        </p>
      )}

      <textarea
        value={props.prompt}
        onChange={(e) => props.onPrompt(e.target.value)}
        disabled={props.running}
        spellCheck={false}
        rows={7}
        className="mono w-full resize-y rounded-lg border border-[--color-line] bg-[--color-ink-900] p-3 text-[12.5px] leading-relaxed text-[--color-fog-100] outline-none focus:border-[--color-cyan]/50 disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-3">
        <label
          className={`flex items-center gap-2 text-[12.5px] ${
            canRedteam ? "cursor-pointer text-[--color-fog-300]" : "cursor-not-allowed text-[--color-fog-600]"
          }`}
        >
          <button
            role="switch"
            aria-checked={props.redteam && canRedteam}
            disabled={!canRedteam || props.running}
            onClick={() => props.onRedteam(!props.redteam)}
            className={`relative h-5 w-9 rounded-full transition ${
              props.redteam && canRedteam ? "bg-[--color-block]" : "bg-[--color-ink-600]"
            } disabled:opacity-40`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                props.redteam && canRedteam ? "left-4" : "left-0.5"
              }`}
            />
          </button>
          <span>
            Red-team mode
            {canRedteam ? (
              <span className="ml-1 text-[--color-fog-500]">— plant a secret + prompt-injection</span>
            ) : (
              <span className="ml-1 text-[--color-fog-600]">(free-type scenario only)</span>
            )}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={props.onReset}
            disabled={props.running}
            className="rounded-lg border border-[--color-line] bg-[--color-ink-850] px-3 py-2 text-[12.5px] font-medium text-[--color-fog-400] transition hover:text-[--color-fog-100] disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={props.onRun}
            disabled={props.running}
            className="rounded-lg border border-[--color-token]/50 bg-[--color-token]/15 px-4 py-2 text-[13px] font-semibold text-[--color-token] transition hover:bg-[--color-token]/25 disabled:opacity-50"
          >
            {props.running ? (
              <span className="flex items-center gap-2">
                <span className="pulse-dot">●</span> running…
              </span>
            ) : (
              "Run agent ▸"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
