import { checkEnabled, type CheckId, type ScanConfig } from "../config.js";
import type { FetchResult } from "./net.js";
import { isAllowed, parseRobots, type Robots } from "./robots.js";
import { looksLikeHtml } from "./html.js";

export const ROBOTS_TOKEN = "agent-landing";

export type Probe = FetchResult & { skipped?: "robots" | "budget" };
export type Fetcher = (url: string, accept: string) => Promise<FetchResult>;

export type PageSnapshot = {
  path: string;
  html: Probe;
  markdownNegotiated: Probe | null;
  markdownVariant: Probe | null;
};

export type Snapshot = {
  origin: string;
  robots: Probe;
  robotsParsed: Robots | null;
  llms: Probe | null;
  llmsFull: Probe | null;
  sitemap: Probe | null;
  sitemapFromRobots: boolean;
  pages: PageSnapshot[];
  apiProbes: Probe[];
  mcpProbes: Probe[];
  requestCount: number;
};

export const ACCEPT_HTML = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";
export const ACCEPT_MARKDOWN = "text/markdown, text/plain;q=0.5";
const ACCEPT_TEXT = "text/plain, text/markdown, */*;q=0.5";
const ACCEPT_ANY = "application/json, application/yaml, text/yaml, text/plain;q=0.8, */*;q=0.5";

export const API_PROBE_PATHS = ["/openapi.json", "/openapi.yaml", "/swagger.json", "/api/openapi.json", "/.well-known/api-catalog"];
export const MCP_PROBE_PATHS = ["/.well-known/mcp.json", "/.well-known/mcp", "/.well-known/mcp/server-card.json"];

export const markdownVariantPath = (path: string): string =>
  path.endsWith("/") ? `${path}index.md` : `${path}.md`;

export const isOk = (p: Probe | null | undefined): boolean => !!p && !p.skipped && !p.error && p.status >= 200 && p.status < 300;

// A 200 that serves the site's HTML shell for a text file is an SPA fallback, not the file.
export const isTextFile = (p: Probe | null | undefined): boolean =>
  !!p && isOk(p) && p.body.trim() !== "" && !looksLikeHtml(p.body, p.headers["content-type"]);

const skippedProbe = (url: string, reason: "robots" | "budget"): Probe => ({
  url,
  finalUrl: url,
  status: 0,
  headers: {},
  body: "",
  bytes: 0,
  truncated: false,
  redirects: [],
  skipped: reason,
});

export const planPages = (target: URL, cfg: ScanConfig): string[] => {
  const given = target.pathname !== "/" ? [target.pathname] : [];
  return [...new Set([...given, ...cfg.keyPages])].slice(0, cfg.maxPages);
};

export const collect = async (target: URL, cfg: ScanConfig, fetcher: Fetcher): Promise<Snapshot> => {
  const origin = target.origin;
  let used = 0;
  let robotsParsed: Robots | null = null;
  const on = (id: CheckId) => checkEnabled(cfg, id);

  const get = async (urlOrPath: string, accept: string): Promise<Probe> => {
    const url = new URL(urlOrPath, origin);
    const sameOrigin = url.origin === origin;
    if (sameOrigin && robotsParsed && !isAllowed(robotsParsed, ROBOTS_TOKEN, url.pathname + url.search))
      return skippedProbe(url.toString(), "robots");
    if (used >= cfg.maxRequests) return skippedProbe(url.toString(), "budget");
    used += 1;
    return fetcher(url.toString(), accept);
  };

  const robots = await get("/robots.txt", ACCEPT_TEXT);
  // RFC 9309: an unreachable robots.txt (5xx) means assume full disallow; 4xx means no restrictions.
  if (isTextFile(robots)) robotsParsed = parseRobots(robots.body);
  else if (robots.status >= 500) robotsParsed = parseRobots("User-agent: *\nDisallow: /");

  const llms = on("llms-txt") || on("api-docs") || on("mcp") ? await get("/llms.txt", ACCEPT_TEXT) : null;
  const llmsFull = on("llms-txt") ? await get("/llms-full.txt", ACCEPT_TEXT) : null;

  const robotsSitemap = robotsParsed?.sitemaps[0];
  const sitemap = on("sitemap") ? await get(robotsSitemap ?? "/sitemap.xml", "application/xml, text/xml;q=0.9, */*;q=0.5") : null;

  const wantMarkdown = on("markdown") || on("page-weight");
  const pages = await Promise.all(
    planPages(target, cfg).map(async (path): Promise<PageSnapshot> => {
      const html = await get(path, ACCEPT_HTML);
      const markdownNegotiated = wantMarkdown ? await get(path, ACCEPT_MARKDOWN) : null;
      const markdownVariant = wantMarkdown ? await get(markdownVariantPath(path), ACCEPT_MARKDOWN) : null;
      return { path, html, markdownNegotiated, markdownVariant };
    }),
  );

  const apiProbes = on("api-docs") ? await Promise.all(API_PROBE_PATHS.map((p) => get(p, ACCEPT_ANY))) : [];
  const mcpProbes = on("mcp") ? await Promise.all(MCP_PROBE_PATHS.map((p) => get(p, ACCEPT_ANY))) : [];

  return {
    origin,
    robots,
    robotsParsed: isTextFile(robots) ? robotsParsed : null,
    llms,
    llmsFull,
    sitemap,
    sitemapFromRobots: !!robotsSitemap,
    pages,
    apiProbes,
    mcpProbes,
    requestCount: used,
  };
};
