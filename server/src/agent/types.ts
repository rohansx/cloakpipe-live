import type { ScenarioId } from "../types.js";

export interface ToolOutcome {
  verdict: "allow" | "redact" | "block";
  blocked: boolean;
  reason: string;
  echoed: unknown;
}

export interface AgentStep {
  thought?: string;
  tool?: { destination: string; payload: unknown };
}

export interface AgentContext {
  scenario: ScenarioId;
  redteam: boolean;
  prompt: string;
}

/**
 * An agent is an async generator: it yields steps (a thought and/or a tool call),
 * receives the tool outcome back via `.next(outcome)`, and finally returns its
 * closing message. Both the scripted and OpenAI agents implement this shape, so
 * the orchestrator is agent-agnostic.
 */
export type Agent = AsyncGenerator<AgentStep, string, ToolOutcome | undefined>;
