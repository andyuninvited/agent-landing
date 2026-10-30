import { json } from "@/lib/agent/content";
import { mcpManifest } from "@/lib/agent/mcp";

export const GET = () => json(mcpManifest());
