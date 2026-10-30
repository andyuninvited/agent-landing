import { MD_HEADERS, llmsTxt } from "@/lib/agent/content";

export const GET = () => new Response(llmsTxt(), { headers: MD_HEADERS });
