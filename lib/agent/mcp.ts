import { features } from "../data";
import { ask, featureById, featureJson, featuresJson, installJson, SITE, SYNTHETIC } from "./content";

// Stateless, read-only MCP over Streamable HTTP (JSON responses only).
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const SERVER_INFO = { name: "agent-landing-demo", title: "Agent-as-User Landing Framework demo", version: "1.0.0" };
export const MAX_BODY_BYTES = 16_000;
export const MAX_QUESTION = 500;

type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; run: (args: Record<string, unknown>) => unknown };

const noArgs = { type: "object", properties: {}, additionalProperties: false };

export const TOOLS: readonly Tool[] = [
  { name: "list_launches", description: `List the demo's example launches with human and agent signals and a verdict. ${SYNTHETIC}`, inputSchema: noArgs, run: () => featuresJson() },
  {
    name: "get_launch",
    description: "Get one example launch by id.",
    inputSchema: { type: "object", properties: { id: { type: "string", enum: features.map((f) => f.id) } }, required: ["id"], additionalProperties: false },
    run: (args) => {
      const f = typeof args.id === "string" ? featureById(args.id) : undefined;
      if (!f) throw new ToolError(`Unknown id. Valid ids: ${features.map((x) => x.id).join(", ")}.`);
      return featureJson(f);
    },
  },
  {
    name: "ask_framework",
    description: "Ask whether a launch landed, for example 'Did sdk-v4 land successfully?'. Deterministic answers over the synthetic data.",
    inputSchema: { type: "object", properties: { question: { type: "string", maxLength: MAX_QUESTION } }, required: ["question"], additionalProperties: false },
    run: (args) => {
      if (typeof args.question !== "string" || !args.question.trim() || args.question.length > MAX_QUESTION) throw new ToolError(`question must be a non-empty string up to ${MAX_QUESTION} characters.`);
      return ask(args.question);
    },
  },
  { name: "get_install", description: "How to run agent-landing on your own product, from the CLI or Claude Code.", inputSchema: noArgs, run: () => installJson() },
];

class ToolError extends Error {}

type Id = string | number;
type RpcResponse = { jsonrpc: "2.0"; id: Id | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id | null, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is Id => typeof v === "string" || typeof v === "number";

const callTool = (params: Record<string, unknown>) => {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) return null;
  try {
    const data = tool.run(isObj(params.arguments) ? params.arguments : {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: Array.isArray(data) ? { items: data } : data, isError: false };
  } catch (e) {
    if (e instanceof ToolError) return { content: [{ type: "text", text: e.message }], isError: true };
    throw e;
  }
};

// Returns null for notifications, which get a 202 with no body.
export const handleRpc = (msg: unknown): RpcResponse | null => {
  if (!isObj(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(null, -32600, "Invalid request");
  if (!("id" in msg)) return null;
  if (!isId(msg.id)) return fail(null, -32600, "Invalid request id");
  const id = msg.id;
  const params = isObj(msg.params) ? msg.params : {};
  switch (msg.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const protocolVersion = PROTOCOL_VERSIONS.find((v) => v === asked) ?? PROTOCOL_VERSIONS[0];
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: `Read-only demo of the Agent-as-User Landing Framework at ${SITE.url}. ${SYNTHETIC} Use get_install to run the real tool on your own product.`,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) });
    case "tools/call": {
      const result = callTool(params);
      return result ? ok(id, result) : fail(id, -32602, `Unknown tool: ${String(params.name)}`);
    }
    default:
      return fail(id, -32601, `Method not found: ${msg.method}`);
  }
};

export const mcpManifest = () => ({
  name: SERVER_INFO.name,
  title: SERVER_INFO.title,
  description: `Read-only MCP server for the ${SITE.name} demo. ${SYNTHETIC}`,
  version: SERVER_INFO.version,
  endpoint: `${SITE.url}/mcp`,
  transport: "streamable-http",
  authentication: "none",
  protocolVersions: PROTOCOL_VERSIONS,
  tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
});
