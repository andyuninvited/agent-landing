import { apiCatalog } from "@/lib/agent/content";

export const GET = () => new Response(JSON.stringify(apiCatalog(), null, 2), { headers: { "Content-Type": "application/linkset+json", "Access-Control-Allow-Origin": "*" } });
