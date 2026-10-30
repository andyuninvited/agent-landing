import { MD_HEADERS, homeMarkdown } from "@/lib/agent/content";

export const GET = () => new Response(homeMarkdown(), { headers: MD_HEADERS });
