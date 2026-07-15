// HTTP + SSE server. Hono orchestrator exposing the run stream, the scenarios,
// and the evidence-ledger operations (read / verify / tamper / reset).

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { ledger, seedNameGazetteer } from "./cloakpipe/index.js";
import { runAgent, type RunParams } from "./orchestrator.js";
import { CANNED_NAMES, listScenarios, SCENARIOS } from "./scenarios.js";
import type { ScenarioId, StreamEvent } from "./types.js";

seedNameGazetteer(CANNED_NAMES);

const app = new Hono();
app.use("/api/*", cors());

// Pending runs: created by POST /api/run, consumed by the SSE stream.
const pending = new Map<string, RunParams>();

app.get("/api/health", (c) => c.json({ ok: true, agent: process.env.OPENAI_API_KEY ? "openai" : "scripted" }));

app.get("/api/scenarios", (c) =>
  c.json({ scenarios: listScenarios(), agent: process.env.OPENAI_API_KEY ? "openai" : "scripted" }),
);

app.post("/api/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const scenario = (body.scenario ?? "fintech") as ScenarioId;
  if (!SCENARIOS[scenario]) return c.json({ error: "unknown scenario" }, 400);
  const redteam = Boolean(body.redteam) && SCENARIOS[scenario].supportsRedteam;
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt : SCENARIOS[scenario].defaultPrompt;
  const runId = randomUUID();
  pending.set(runId, { runId, scenario, redteam, prompt });
  return c.json({ runId });
});

app.get("/api/stream", (c) => {
  const runId = c.req.query("runId") ?? "";
  const params = pending.get(runId);
  return streamSSE(c, async (stream) => {
    if (!params) {
      await stream.writeSSE({ event: "message", data: JSON.stringify({ kind: "error", message: "unknown or expired runId" } satisfies StreamEvent) });
      return;
    }
    pending.delete(runId);
    const queue: StreamEvent[] = [];
    let done = false;
    const emit = (e: StreamEvent) => {
      queue.push(e);
      if (e.kind === "run_done") done = true;
    };
    const running = runAgent(params, emit);

    // Drain the queue as events are produced.
    while (!done || queue.length) {
      if (queue.length === 0) {
        await new Promise((r) => setTimeout(r, 15));
        continue;
      }
      const e = queue.shift()!;
      await stream.writeSSE({ event: "message", data: JSON.stringify(e) });
    }
    await running;
  });
});

app.get("/api/ledger", (c) => c.json({ entries: ledger.all() }));

app.post("/api/ledger/verify", (c) => c.json(ledger.verify()));

app.post("/api/ledger/reset", (c) => {
  ledger.reset();
  return c.json({ ok: true });
});

app.post("/api/ledger/tamper", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const seq = Number(body.seq);
  const field = body.field as "action" | "verdict" | "reason" | "payload_hash";
  const value = String(body.value ?? "");
  if (!Number.isFinite(seq) || !["action", "verdict", "reason", "payload_hash"].includes(field)) {
    return c.json({ error: "seq and a valid field are required" }, 400);
  }
  const ok = ledger.tamper(seq, field, value);
  return c.json({ ok, entries: ledger.all() });
});

// Serve the built frontend in production (single-machine deploy).
const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  // @hono/node-server serveStatic resolves `root` relative to the cwd.
  const root = relative(process.cwd(), webDist) || ".";
  app.use("/*", serveStatic({ root }));
  app.get("/*", serveStatic({ path: "index.html", root }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`CloakPipe Live server on http://localhost:${info.port}`);
  console.log(`Agent runtime: ${process.env.OPENAI_API_KEY ? "OpenAI" : "scripted (deterministic fallback)"}`);
});
