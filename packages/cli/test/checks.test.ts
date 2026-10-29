import { describe, expect, it } from "vitest";
import { apiDocsCheck, authFrictionCheck, mcpCheck } from "../src/scan/checks/access.js";
import { markdownCheck, pageWeightCheck, ssrCheck, structuredDataCheck } from "../src/scan/checks/content.js";
import { llmsTxtCheck, robotsCheck, sitemapCheck } from "../src/scan/checks/discovery.js";
import { parseRobots } from "../src/scan/robots.js";
import { notFound, page, probe, scanConfig, snapshot } from "./helpers.js";

const cfg = scanConfig();
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const richPage = `<html><head><title>Acme</title><meta name="description" content="d"></head><body><h1>Acme</h1><p>${words(200)}</p></body></html>`;
const robotsSnap = (text: string) => snapshot({ robots: probe("/robots.txt", { body: text, type: "text/plain" }), robotsParsed: parseRobots(text) });

describe("robots-ai", () => {
  it("scores a missing robots.txt as allowed but implicit", () => {
    const r = robotsCheck.run(snapshot(), cfg);
    expect(r.score).toBe(70);
    expect(r.fix).toMatch(/Publish \/robots.txt/);
  });

  it("gives full marks for explicit allow plus a Sitemap line", () => {
    const r = robotsCheck.run(robotsSnap("User-agent: ClaudeBot\nAllow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://example.com/s.xml"), cfg);
    expect(r.score).toBe(100);
    expect(r.fix).toBeNull();
  });

  it("calls out blocked user-triggered agents", () => {
    const r = robotsCheck.run(robotsSnap("User-agent: *\nDisallow: /"), cfg);
    expect(r.score).toBe(0);
    expect(r.fix).toMatch(/Claude-User/);
    expect(r.details).toContain("ClaudeBot blocked on /");
  });

  it("treats a 5xx robots.txt as disallow-all", () => {
    expect(robotsCheck.run(snapshot({ robots: probe("/robots.txt", { status: 503 }) }), cfg).score).toBe(20);
  });

  it("skips when the request budget ran out", () => {
    expect(robotsCheck.run(snapshot({ robots: probe("/robots.txt", { skipped: "budget" }) }), cfg).score).toBeNull();
  });
});

describe("llms-txt", () => {
  const good = "# Acme\n\n> Acme deploys apps.\n\n## Docs\n- [Start](/docs/start.md)\n- [API](/docs/api.md)\n- [CLI](/docs/cli.md)\n";
  it("scores a complete llms.txt plus llms-full.txt at 100", () => {
    const r = llmsTxtCheck.run(snapshot({ llms: probe("/llms.txt", { body: good, type: "text/plain" }), llmsFull: probe("/llms-full.txt", { body: "full", type: "text/plain" }) }), cfg);
    expect(r.score).toBe(100);
  });
  it("lists gaps in a thin llms.txt", () => {
    const r = llmsTxtCheck.run(snapshot({ llms: probe("/llms.txt", { body: "Acme", type: "text/plain" }) }), cfg);
    expect(r.score).toBe(50);
    expect(r.fix).toMatch(/H1.*summary.*three key docs.*llms-full/);
  });
  it("does not count an SPA fallback that serves HTML", () => {
    const r = llmsTxtCheck.run(snapshot({ llms: probe("/llms.txt", { body: "<!doctype html><html></html>", type: "text/html" }) }), cfg);
    expect(r.score).toBe(0);
    expect(r.reason).toMatch(/HTML page instead/);
  });
});

describe("sitemap", () => {
  const xml = (paths: string[]) => `<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>https://example.com${p}</loc></url>`).join("")}</urlset>`;
  it("rewards a robots-referenced sitemap that lists every key page", () => {
    const r = sitemapCheck.run(snapshot({ sitemap: probe("/s.xml", { body: xml(["/", "/docs/"]), type: "application/xml" }), sitemapFromRobots: true, pages: [page("/", ""), page("/docs", "")] }), cfg);
    expect(r.score).toBe(100);
  });
  it("names key pages the sitemap leaves out", () => {
    const r = sitemapCheck.run(snapshot({ sitemap: probe("/sitemap.xml", { body: xml(["/"]) }), pages: [page("/", ""), page("/pricing", "")] }), cfg);
    expect(r.score).toBe(70);
    expect(r.fix).toMatch(/\/pricing/);
  });
  it("fails when there is no sitemap", () => {
    expect(sitemapCheck.run(snapshot(), cfg).score).toBe(0);
  });
});

describe("ssr-readable", () => {
  it("passes server-rendered pages with title, description, and h1", () => {
    expect(ssrCheck.run(snapshot({ pages: [page("/", richPage)] }), cfg).score).toBe(100);
  });
  it("flags a JS-only shell", () => {
    const r = ssrCheck.run(snapshot({ pages: [page("/", '<html><head><title>App</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>')] }), cfg);
    expect(r.score).toBe(10);
    expect(r.reason).toMatch(/JS-only/);
    expect(r.details[0]).toMatch(/empty JS mount point/);
  });
  it("scores HTTP failures as zero and ignores robots-skipped pages", () => {
    const failed = { ...page("/", ""), html: probe("/", { status: 500 }) };
    const skipped = { ...page("/admin", ""), html: probe("/admin", { skipped: "robots" }) };
    const r = ssrCheck.run(snapshot({ pages: [failed, skipped] }), cfg);
    expect(r.score).toBe(0);
    expect(r.details).toEqual(["/: 0 (HTTP 500)"]);
  });
});

describe("markdown", () => {
  it("credits content negotiation and advertising", () => {
    const html = '<html><head><link rel="alternate" type="text/markdown" href="/index.md"></head></html>';
    const r = markdownCheck.run(snapshot({ pages: [page("/", html, { markdownNegotiated: probe("/", { body: "# Hi", type: "text/markdown" }) })] }), cfg);
    expect(r.score).toBe(100);
  });
  it("credits a .md variant without advertising", () => {
    const r = markdownCheck.run(snapshot({ pages: [page("/docs", "<html></html>", { markdownVariant: probe("/docs.md", { body: "# Docs", type: "text/plain" }) })] }), cfg);
    expect(r.score).toBe(85);
    expect(r.fix).toMatch(/Advertise/);
  });
  it("fails when only HTML comes back", () => {
    expect(markdownCheck.run(snapshot(), cfg).score).toBe(0);
  });
});

describe("structured-data", () => {
  it("reads @type from JSON-LD, including @graph", () => {
    const html = '<script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["SoftwareApplication"]}]}</script>';
    const r = structuredDataCheck.run(snapshot({ pages: [page("/", html)] }), cfg);
    expect(r.score).toBe(100);
    expect(r.details[0]).toMatch(/Organization, SoftwareApplication/);
  });
  it("penalizes invalid blocks and credits OpenGraph a little", () => {
    const bad = '<script type="application/ld+json">{nope</script><script type="application/ld+json">{"@type":"WebSite"}</script>';
    expect(structuredDataCheck.run(snapshot({ pages: [page("/", bad)] }), cfg).score).toBe(80);
    expect(structuredDataCheck.run(snapshot({ pages: [page("/", '<meta property="og:title" content="x">')] }), cfg).score).toBe(40);
  });
});

describe("page-weight", () => {
  it("passes a light page", () => {
    expect(pageWeightCheck.run(snapshot({ pages: [page("/", richPage)] }), cfg).score).toBe(100);
  });
  it("scores a heavy page down and suggests markdown", () => {
    const heavy = `<html><body><script>${"x".repeat(300_000)}</script><p>hi</p></body></html>`;
    const r = pageWeightCheck.run(snapshot({ pages: [page("/", heavy)] }), cfg);
    expect(r.score).toBe(40);
    expect(r.fix).toMatch(/markdown/);
  });
  it("uses the markdown version when one exists", () => {
    const heavy = `<html><body><script>${"x".repeat(300_000)}</script></body></html>`;
    const r = pageWeightCheck.run(snapshot({ pages: [page("/", heavy, { markdownVariant: probe("/index.md", { body: "# Light", type: "text/markdown" }) })] }), cfg);
    expect(r.score).toBe(100);
  });
});

it("structured-data and page-weight skip pages that failed to load", () => {
  const failed = snapshot({ pages: [{ ...page("/", ""), html: probe("/", { status: 500 }) }] });
  expect(structuredDataCheck.run(failed, cfg).score).toBeNull();
  expect(pageWeightCheck.run(failed, cfg).score).toBeNull();
});

describe("api-docs", () => {
  it("finds an OpenAPI spec", () => {
    const r = apiDocsCheck.run(snapshot({ apiProbes: [notFound("/openapi.json"), probe("/openapi.yaml", { body: "openapi: 3.1.0\ninfo: {}", type: "application/yaml" })] }), cfg);
    expect(r.score).toBe(95);
    expect(r.reason).toMatch(/\/openapi.yaml/);
  });
  it("falls back to linked docs", () => {
    const r = apiDocsCheck.run(snapshot({ pages: [page("/", '<a href="/docs/api">API</a>')], apiProbes: [notFound("/openapi.json")] }), cfg);
    expect(r.score).toBe(50);
  });
  it("finds a spec link in llms.txt", () => {
    const r = apiDocsCheck.run(snapshot({ llms: probe("/llms.txt", { body: "- [Spec](https://api.example.com/v1/openapi.json)", type: "text/plain" }) }), cfg);
    expect(r.score).toBe(80);
  });
  it("tells builders without an API how to opt out", () => {
    const r = apiDocsCheck.run(snapshot({ apiProbes: [notFound("/openapi.json")] }), cfg);
    expect(r.score).toBe(0);
    expect(r.fix).toMatch(/"enabled": false/);
  });
});

describe("mcp", () => {
  it("finds a well-known discovery document", () => {
    const r = mcpCheck.run(snapshot({ mcpProbes: [probe("/.well-known/mcp.json", { body: '{"servers":[]}', type: "application/json" })] }), cfg);
    expect(r.score).toBe(100);
  });
  it("credits a documented endpoint", () => {
    const r = mcpCheck.run(snapshot({ pages: [page("/", "<p>Connect our MCP server at https://mcp.example.com/sse</p>")] }), cfg);
    expect(r.score).toBe(75);
  });
  it("credits a bare mention less", () => {
    expect(mcpCheck.run(snapshot({ pages: [page("/", "<p>Model Context Protocol support soon</p>")] }), cfg).score).toBe(45);
  });
  it("reports nothing found", () => {
    expect(mcpCheck.run(snapshot(), cfg).score).toBe(0);
  });
});

describe("auth-friction", () => {
  it("passes open pages", () => {
    expect(authFrictionCheck.run(snapshot({ pages: [page("/", richPage)] }), cfg).score).toBe(100);
  });
  it("flags login redirects, bot challenges, and CAPTCHAs", () => {
    const login = { ...page("/docs", ""), html: probe("/docs", { body: '<input type="password">', finalPath: "/login?next=/docs" }) };
    const challenge = page("/pricing", "<title>Just a moment...</title><div class='cf-turnstile'></div>");
    const r = authFrictionCheck.run(snapshot({ pages: [login, challenge] }), cfg);
    expect(r.details).toEqual(["/docs: 25 (redirects to login (/login), password field on the page)", "/pricing: 5 (bot challenge page, CAPTCHA widget)"]);
    expect(r.score).toBe(15);
  });
  it("flags 401 and 403", () => {
    const r = authFrictionCheck.run(snapshot({ pages: [{ ...page("/", ""), html: probe("/", { status: 403, body: "Forbidden" }) }] }), cfg);
    expect(r.score).toBe(40);
  });
});
