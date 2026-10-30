import { json, openApiSpec } from "@/lib/agent/content";

export const GET = () => json(openApiSpec());
