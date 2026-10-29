import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { scanConfigSchema, type ScanConfig } from "../src/config.js";
import type { PageSnapshot, Probe, Snapshot } from "../src/scan/collect.js";

export const probe = (path: string, opts: { status?: number; body?: string; type?: string; finalPath?: string; skipped?: "robots" | "budget"; error?: string } = {}): Probe => {
  const url = `https://example.com${path}`;
  return {
    url,
    finalUrl: `https://example.com${opts.finalPath ?? path}`,
    status: opts.error ? 0 : opts.status ?? 200,
    headers: opts.type ? { "content-type": opts.type } : {},
    body: opts.body ?? "",
    bytes: (opts.body ?? "").length,
    truncated: false,
    redirects: [],
    ...(opts.skipped ? { skipped: opts.skipped } : {}),
    ...(opts.error ? { error: opts.error } : {}),
  };
};

export const notFound = (path: string): Probe => probe(path, { status: 404, body: "Not found", type: "text/plain" });

export const page = (path: string, html: string, extra: Partial<PageSnapshot> = {}): PageSnapshot => ({
  path,
  html: probe(path, { body: html, type: "text/html" }),
  markdownNegotiated: probe(path, { body: html, type: "text/html" }),
  markdownVariant: notFound(path === "/" ? "/index.md" : `${path}.md`),
  ...extra,
});

export const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  origin: "https://example.com",
  robots: notFound("/robots.txt"),
  robotsParsed: null,
  llms: notFound("/llms.txt"),
  llmsFull: notFound("/llms-full.txt"),
  sitemap: notFound("/sitemap.xml"),
  sitemapFromRobots: false,
  pages: [page("/", "<html><head><title>x</title></head><body><h1>Hi</h1></body></html>")],
  apiProbes: [],
  mcpProbes: [],
  requestCount: 0,
  ...over,
});

export const scanConfig = (over: Record<string, unknown> = {}): ScanConfig => scanConfigSchema.parse(over);

export type Route = { status?: number; type?: string; body: string | Buffer; headers?: Record<string, string>; hang?: boolean };
export type Site = Record<string, Route | ((req: IncomingMessage) => Route)>;

export const serve = async (site: Site): Promise<{ url: string; hits: string[]; close: () => Promise<void>; server: Server }> => {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    const path = req.url ?? "/";
    hits.push(`${path} ${req.headers.accept ?? ""}`);
    const entry = site[path];
    const route = typeof entry === "function" ? entry(req) : entry;
    if (!route) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    if (route.hang) return;
    res.writeHead(route.status ?? 200, { "content-type": route.type ?? "text/html; charset=utf-8", ...route.headers });
    res.end(route.body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    server,
    close: () => new Promise((r) => server.close(() => r())),
  };
};
