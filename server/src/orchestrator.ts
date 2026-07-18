// Orchestrator: drives an agent loop and routes every tool call through the
// CloakPipe adapter *before* it reaches a tool. Allowed/redacted calls hit the
// mock tool with the sanitized payload (which the tool echoes back); blocked
// calls never touch the tool. Everything is streamed out as it happens.

import { processEgress } from "./cloakpipe/index.js";
import { callTool } from "./tools/index.js";
import { scriptedAgent } from "./agent/scripted.js";
import { openaiAgent } from "./agent/openai.js";
import type { Agent, AgentContext, ToolOutcome } from "./agent/types.js";
import type { ScenarioId, StreamEvent } from "./types.js";

export interface RunParams {
  runId: string;
  scenario: ScenarioId;
  redteam: boolean;
  prompt: string;
}

type Emit = (e: StreamEvent) => void;

function pickAgent(ctx: AgentContext): { agent: Agent; kind: "openai" | "scripted" } {
  if (process.env.OPENAI_API_KEY) {
    try {
      return { agent: openaiAgent(ctx), kind: "openai" };
    } catch {
      // fall through to scripted
    }
  }
  return { agent: scriptedAgent(ctx), kind: "scripted" };
}

export async function runAgent(params: RunParams, emit: Emit): Promise<void> {
  const ctx: AgentContext = {
    scenario: params.scenario,
    redteam: params.redteam,
    prompt: params.prompt,
  };
  const { agent, kind } = pickAgent(ctx);

  emit({ kind: "run_started", runId: params.runId, scenario: params.scenario, redteam: params.redteam, agent: kind });

  try {
    let outcome: ToolOutcome | undefined;
    let next = await agent.next();

    while (!next.done) {
      const stepValue = next.value;

      if (stepValue.thought) {
        emit({ kind: "agent_thought", text: stepValue.thought });
      }

      if (stepValue.tool) {
        const { destination, payload } = stepValue.tool;
        const result = processEgress(destination, payload, params.scenario);

        // Left panel: what the agent tried to send.
        emit({ kind: "agent_tool_call", id: result.id, destination, raw: result.raw });

        // Right panel + ledger: what CloakPipe let out.
        emit({
          kind: "egress_verdict",
          id: result.id,
          verdict: result.verdict,
          policy_id: result.policy_id,
          reason: result.reason,
          sanitized: result.sanitized,
          ledger: result.ledger,
          blocked: result.blocked,
        });

        // Only non-blocked calls actually reach a tool.
        let echoed: unknown = null;
        if (!result.blocked) {
          const { received } = callTool(destination, result.sanitized.payload);
          echoed = received;
        }
        emit({ kind: "tool_result", id: result.id, destination, echoed, blocked: result.blocked });

        outcome = {
          verdict: result.verdict,
          blocked: result.blocked,
          reason: result.reason,
          echoed,
        };
        next = await agent.next(outcome);
      } else {
        next = await agent.next(outcome);
      }
    }

    emit({ kind: "agent_final", text: next.value });
  } catch (err) {
    emit({ kind: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    emit({ kind: "run_done" });
  }
}
