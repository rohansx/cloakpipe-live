// Mock downstream tools, framed as MCP tool calls. The one rule that makes the
// demo honest: each tool echoes back exactly what it RECEIVED. So when the CRM's
// echo shows only tokens, that's proof the redaction happened on the wire — not
// a claim we're asking anyone to trust.

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema (OpenAI tool format)
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "crm_lookup",
    description: "Look up a customer/patient account in the CRM by any identifying fields.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text lookup query (email, phone, name)." },
        account_holder: { type: "string" },
        pan: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a customer/patient.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "http_post",
    description: "POST a JSON body to an internal audit or routing endpoint.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        body: { type: "object" },
      },
      required: ["url", "body"],
    },
  },
];

/**
 * "Call" a mock tool. It receives the already-sanitized payload and returns an
 * echo of what it saw, so the downstream view is literally the received bytes.
 */
export function callTool(name: string, receivedPayload: unknown): { received: unknown; note: string } {
  const note =
    name === "crm_lookup"
      ? "CRM received and echoed this lookup. It only ever saw these values."
      : name === "send_email"
        ? "Mail gateway received and echoed this message. It only ever saw these values."
        : "Audit sink received and echoed this POST body. It only ever saw these values.";
  return { received: receivedPayload, note };
}

export function isKnownTool(name: string): boolean {
  return TOOL_DEFS.some((t) => t.name === name);
}
