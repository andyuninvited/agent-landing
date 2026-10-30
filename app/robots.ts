import type { MetadataRoute } from "next";
import { SITE } from "@/lib/agent/content";

// Named groups make the AI agent policy explicit rather than a fallback to *.
export const AI_AGENTS = ["ClaudeBot", "Claude-User", "Claude-SearchBot", "GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: AI_AGENTS, allow: "/" }, { userAgent: "*", allow: "/" }], sitemap: `${SITE.url}/sitemap.xml` };
}
