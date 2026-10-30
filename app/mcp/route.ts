import { handleRpc, MAX_BODY_BYTES } from "@/lib/agent/mcp";

const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
  let msg: unknown;
  try {
    msg = JSON.parse(text);
  } catch {
    return reply({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const res = handleRpc(msg);
  return res ? reply(res) : new Response(null, { status: 202, headers: { "Access-Control-Allow-Origin": "*" } });
}

export const GET = () => new Response("This MCP server uses Streamable HTTP with JSON responses. POST JSON-RPC to this URL.", { status: 405, headers: { Allow: "POST" } });

export const OPTIONS = () =>
  new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id" } });
