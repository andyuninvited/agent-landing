import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runScan } from "../src/scan/index.js";
import { scanConfig, serve, type Site } from "./helpers.js";

const words = Array.from({ length: 220 }, (_, i) => `w${i}`).join(" ");

const goodSite = (origin: () => string): Site => ({
  "/robots.txt": () => ({ type: "text/plain", body: `User-agent: ClaudeBot\nAllow: /\n\nUser-agent: *\nAllow: /\nDisallow: /internal\n\nSitemap: ${origin()}/sitemap.xml\n` }),
  "/llms.txt": { type: "text/plain", body: "# Acme\n\n> Acme deploys apps for humans and agents.\n\n- [Docs](/docs.md)\n- [API](/openapi.json)\n- [MCP](https://mcp.acme.test/mcp)\n" },
  "/llms-full.txt": { type: "text/plain", body: "# Acme full docs" },
  "/sitemap.xml": () => ({ type: "application/xml", body: `<urlset><url><loc>${origin()}/</loc></url><url><loc>${origin()}/docs</loc></url></urlset>` }),
  "/": (req) =>
    /markdown/.test(req.headers.accept ?? "")
      ? { type: "text/markdown", body: "# Acme\n\nDeploy apps." }
      : {
          body: `<!doctype html><html><head><title>Acme</title><meta name="description" content="Deploy apps"><link rel="alternate" type="text/markdown" href="/index.md"><script type="application/ld+json">{"@type":"SoftwareApplication"}</script></head><body><h1>Acme</h1><p>${words}</p><a href="/docs/api">API</a></body></html>`,
        },
  "/docs": {
    body: `<!doctype html><html><head><title>Docs</title><meta name="description" content="Docs"><link rel="alternate" type="text/markdown" href="/docs.md"><script type="application/ld+json">{"@type":"TechArticle"}</script></head><body><h1>Docs</h1><p>${words}</p></body></html>`,
  },
  "/docs.md": { type: "text/markdown", body: "# Docs" },
  "/openapi.json": { type: "application/json", body: '{"openapi":"3.1.0","info":{"title":"Acme","version":"1"}}' },
  "/.well-known/api-catalog": { type: "application/linkset+json", body: '{"linkset":[]}' },
  "/.well-known/mcp.json": { type: "application/json", body: '{"name":"acme","url":"https://mcp.acme.test/mcp"}' },
});

const spaShell = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
const badSite: Site = {
  "/robots.txt": { type: "text/plain", body: "User-agent: *\nDisallow: /private\n\nUser-agent: ClaudeBot\nUser-agent: Claude-User\nDisallow: /\n" },
  "/": { body: spaShell },
  "/llms.txt": { body: spaShell },
  "/docs": { status: 302, body: "", headers: { location: "/login?next=/docs" } },
  "/login": { body: '<html><body><form><input type="password"></form><div class="g-recaptcha"></div></body></html>' },
  "/private": { body: "secret" },
};

describe("scan against a local fixture server", () => {
  let good: Awaited<ReturnType<typeof serve>>;
  let bad: Awaited<ReturnType<typeof serve>>;
  beforeAll(async () => {
    let origin = "";
    good = await serve(goodSite(() => origin));
    origin = good.url;
    bad = await serve(badSite);
  });
  afterAll(async () => {
    await good.close();
    await bad.close();
  });

  it("scores an agent-ready site high with nothing urgent to fix", async () => {
    const report = await runScan(good.url, scanConfig({ keyPages: ["/", "/docs"] }), { allowPrivate: ["127.0.0.1"] });
    const by = Object.fromEntries(report.checks.map((c) => [c.id, c.score]));
    expect(by).toEqual({
      "robots-ai": 100,
      "llms-txt": 100,
      sitemap: 100,
      "ssr-readable": 100,
      markdown: 100,
      "structured-data": 100,
      "api-docs": 100,
      mcp: 100,
      "auth-friction": 100,
      "page-weight": 100,
    });
    expect(report.overall).toBe(100);
    expect(report.fixes).toEqual([]);
    expect(good.hits.every((h) => !h.startsWith("/internal"))).toBe(true);
    expect(report.requestCount).toBeLessThanOrEqual(40);
  });

  it("scores an agent-hostile site low and orders fixes by impact", async () => {
    const report = await runScan(`${bad.url}/`, scanConfig({ keyPages: ["/", "/docs", "/private"] }), { allowPrivate: ["127.0.0.1"] });
    const by = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(by["robots-ai"]!.score).toBeLessThan(80);
    expect(by["llms-txt"]!.score).toBe(0);
    expect(by["ssr-readable"]!.reason).toMatch(/JS-only/);
    expect(by["auth-friction"]!.reason).toMatch(/redirects to login/);
    expect(report.overall).toBeLessThan(40);
    const gains = report.fixes.map((f) => f.potentialGain);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
  });

  it("respects robots.txt for its own fetching", async () => {
    await runScan(bad.url, scanConfig({ keyPages: ["/private"] }), { allowPrivate: ["127.0.0.1"] });
    expect(bad.hits.some((h) => h.startsWith("/private"))).toBe(false);
  });

  it("stops at the request budget", async () => {
    const before = good.hits.length;
    const report = await runScan(good.url, scanConfig({ keyPages: ["/", "/docs"], maxRequests: 5 }), { allowPrivate: ["127.0.0.1"] });
    expect(good.hits.length - before).toBe(5);
    expect(report.requestCount).toBe(5);
  });

  it("refuses the fixture server without an explicit private allowance", async () => {
    const before = good.hits.length;
    await expect(runScan(good.url, scanConfig(), {})).rejects.toThrow(/Could not reach .*private or reserved/);
    expect(good.hits.length).toBe(before);
  });

  it("only runs enabled checks", async () => {
    const before = good.hits.length;
    const report = await runScan(good.url, scanConfig({ checks: { mcp: { enabled: false }, "api-docs": { enabled: false } } }), { allowPrivate: ["127.0.0.1"] });
    expect(report.checks.map((c) => c.id)).not.toContain("mcp");
    expect(good.hits.slice(before).some((h) => h.startsWith("/.well-known/mcp") || h.startsWith("/openapi"))).toBe(false);
  });
});
