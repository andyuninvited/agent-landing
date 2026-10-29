import { describe, expect, it } from "vitest";
import { hasNamedGroup, isAllowed, parseRobots } from "../src/scan/robots.js";

const robots = parseRobots(`# comment
User-agent: *
Disallow: /admin
Allow: /admin/public

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /private*.html$
Disallow:

Sitemap: https://example.com/sitemap.xml
`);

describe("robots.txt", () => {
  it("parses groups, shared user-agent lines, and sitemaps", () => {
    expect(robots.groups).toHaveLength(3);
    expect(robots.groups[1]!.agents).toEqual(["gptbot", "ccbot"]);
    expect(robots.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
    expect(hasNamedGroup(robots, "GPTBot")).toBe(true);
    expect(hasNamedGroup(robots, "PerplexityBot")).toBe(false);
  });

  it("applies the longest match, with allow winning ties", () => {
    expect(isAllowed(robots, "PerplexityBot", "/admin/x")).toBe(false);
    expect(isAllowed(robots, "PerplexityBot", "/admin/public/x")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /a\nAllow: /a"), "x", "/a")).toBe(true);
  });

  it("uses a named group instead of * and matches case-insensitively", () => {
    expect(isAllowed(robots, "gptbot", "/docs")).toBe(false);
    expect(isAllowed(robots, "ClaudeBot", "/admin")).toBe(true);
  });

  it("supports * wildcards and $ anchors", () => {
    expect(isAllowed(robots, "ClaudeBot", "/private-notes.html")).toBe(false);
    expect(isAllowed(robots, "ClaudeBot", "/private-notes.html?x=1")).toBe(true);
  });

  it("allows everything when there are no rules", () => {
    expect(isAllowed(parseRobots(""), "anyone", "/")).toBe(true);
  });
});
