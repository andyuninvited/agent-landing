import { MD_HEADERS, llmsFullTxt } from "@/lib/agent/content";

export const GET = () => new Response(llmsFullTxt(), { headers: MD_HEADERS });
