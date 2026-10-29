import { describe, expect, it } from "vitest";
import { anchorHrefs, decodeEntities, hasH1, jsonLdBlocks, looksLikeHtml, looksLikeJsShell, metaContent, title, visibleText, wordCount } from "../src/scan/html.js";

const doc = `<!doctype html><html><head><title> Acme &amp; Co </title>
<meta name="description" content="Deploy &quot;fast&quot;">
<meta property="og:title" content="Acme">
<script type="application/ld+json">{"@type":"Organization"}</script>
<style>.x{color:red}</style></head>
<body><h1><span>Acme</span></h1><!-- hidden --><p>Ship it now.</p>
<script>var secret = "do not count me";</script><a href="/docs/api">API</a><a href='/pricing'>P</a></body></html>`;

describe("html extraction", () => {
  it("reads title, meta, h1, links, and JSON-LD", () => {
    expect(title(doc)).toBe("Acme & Co");
    expect(metaContent(doc, "description")).toBe('Deploy "fast"');
    expect(metaContent(doc, "og:title")).toBe("Acme");
    expect(hasH1(doc)).toBe(true);
    expect(hasH1("<h1>  </h1>")).toBe(false);
    expect(anchorHrefs(doc)).toEqual(["/docs/api", "/pricing"]);
    expect(jsonLdBlocks(doc)).toEqual(['{"@type":"Organization"}']);
  });

  it("drops scripts, styles, and comments from visible text", () => {
    const text = visibleText(doc);
    expect(text).toContain("Ship it now.");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("color");
    expect(text).not.toContain("hidden");
    expect(wordCount(text)).toBeGreaterThan(3);
  });

  it("detects JS-only shells", () => {
    expect(looksLikeJsShell('<body><div id="root"></div><script src="/app.js"></script></body>')).toBe(true);
    expect(looksLikeJsShell("<noscript>You need to enable JavaScript to run this app.</noscript>")).toBe(true);
    expect(looksLikeJsShell(doc)).toBe(false);
  });

  it("decodes numeric entities and tells HTML from text", () => {
    expect(decodeEntities("&#65;&#x42;&bogus;")).toBe("AB&bogus;");
    expect(looksLikeHtml("# Title", "text/plain")).toBe(false);
    expect(looksLikeHtml("<!DOCTYPE html><html>", "text/plain")).toBe(true);
    expect(looksLikeHtml("x", "text/html; charset=utf-8")).toBe(true);
  });
});
