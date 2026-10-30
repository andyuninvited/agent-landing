import { ask, json } from "@/lib/agent/content";
import { MAX_QUESTION } from "@/lib/agent/mcp";

export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > MAX_QUESTION) return json({ error: `q must be a non-empty question up to ${MAX_QUESTION} characters` }, 400);
  return json(ask(q));
}
