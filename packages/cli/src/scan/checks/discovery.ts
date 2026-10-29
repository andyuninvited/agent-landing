import { isOk, isTextFile } from "../collect.js";
import { hasNamedGroup, isAllowed } from "../robots.js";
import { clip, outcome, skipReason, type Check } from "../types.js";

const USER_TRIGGERED = ["claude-user", "chatgpt-user", "perplexity-user"];

export const robotsCheck: Check = {
  id: "robots-ai",
  title: "robots.txt rules for AI agents",
  run: (s, cfg) => {
    const r = s.robots;
    const skip = skipReason(r);
    if (skip) return outcome(null, `Could not check robots.txt: ${skip}.`, null);
    if (r.error) return outcome(null, `Could not fetch robots.txt: ${r.error}.`, null);
    if (r.status >= 500)
      return outcome(
        20,
        `robots.txt returns HTTP ${r.status}. Under RFC 9309 crawlers treat an unreachable robots.txt as disallow-all, so agents may skip the whole site.`,
        "Serve /robots.txt with HTTP 200 and an explicit policy for AI agents.",
      );
    const parsed = s.robotsParsed;
    if (!parsed)
      return outcome(
        70,
        `No robots.txt (${isOk(r) ? "the URL serves HTML" : `HTTP ${r.status}`}). Agents are allowed by default, but there is no explicit AI agent policy and no Sitemap line.`,
        "Publish /robots.txt with explicit groups for the AI agents you want (for example ClaudeBot, Claude-User, GPTBot, ChatGPT-User, and PerplexityBot) and a Sitemap: line.",
      );

    const paths = s.pages.map((p) => p.path);
    const perAgent = cfg.agentUserAgents.map((ua) => ({ ua, blocked: paths.filter((p) => !isAllowed(parsed, ua, p)) }));
    const pairs = perAgent.length * paths.length;
    const allowed = pairs - perAgent.reduce((n, a) => n + a.blocked.length, 0);
    const explicit = cfg.agentUserAgents.filter((ua) => hasNamedGroup(parsed, ua));
    const hasSitemap = parsed.sitemaps.length > 0;
    const blocked = perAgent.filter((a) => a.blocked.length > 0);
    const blockedUserTriggered = blocked.filter((a) => USER_TRIGGERED.includes(a.ua.toLowerCase()));

    const score = (allowed / pairs) * 80 + (explicit.length > 0 ? 10 : 0) + (hasSitemap ? 10 : 0);
    const reason = [
      blocked.length === 0
        ? `All ${perAgent.length} AI agents checked may fetch every key page.`
        : `${blocked.length} of ${perAgent.length} AI agents are blocked from at least one key page.`,
      explicit.length > 0
        ? `robots.txt names ${explicit.length} AI agent(s) explicitly.`
        : "No AI agent is named, so they all fall back to the * group.",
      hasSitemap ? "" : "No Sitemap: line.",
    ]
      .filter(Boolean)
      .join(" ");
    const fixes = [
      blockedUserTriggered.length > 0
        ? `Allow user-triggered agents (${blockedUserTriggered.map((a) => a.ua).join(", ")}) on your key pages; they fetch on behalf of a person who asked about your product.`
        : "",
      blocked.length > 0 && blockedUserTriggered.length === 0
        ? `Review the blocks on ${blocked.map((a) => a.ua).join(", ")}. If blocking training crawlers is deliberate, keep it and make sure agents acting for users stay allowed.`
        : "",
      explicit.length === 0 ? "Add explicit User-agent groups for the AI agents you want, so your policy is a decision rather than a default." : "",
      hasSitemap ? "" : "Add a Sitemap: line pointing at your sitemap.",
    ].filter(Boolean);
    return outcome(
      score,
      reason,
      fixes.length ? fixes.join(" ") : null,
      blocked.map((a) => `${a.ua} blocked on ${a.blocked.join(", ")}`),
    );
  },
};

export const llmsTxtCheck: Check = {
  id: "llms-txt",
  title: "llms.txt and llms-full.txt",
  run: (s) => {
    const llms = s.llms;
    if (!llms) return outcome(null, "Not fetched.", null);
    const skip = skipReason(llms);
    if (skip) return outcome(null, `Could not check llms.txt: ${skip}.`, null);
    const hasFull = isTextFile(s.llmsFull);
    if (!isTextFile(llms)) {
      const why = isOk(llms) ? "the URL serves an HTML page instead of a text file" : llms.error ?? `HTTP ${llms.status}`;
      return outcome(
        hasFull ? 40 : 0,
        `No /llms.txt (${why}).${hasFull ? " /llms-full.txt exists, but agents look for the short index first." : ""}`,
        "Publish /llms.txt: a markdown file with an H1 product name, a one-paragraph > summary, and sections of links to your most useful docs. Add /llms-full.txt with the full docs inlined if they fit in a model context.",
      );
    }
    const body = llms.body;
    const h1 = /^\s*# \S/.test(body);
    const summary = /^>\s*\S/m.test(body);
    const links = (body.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
    const score = 50 + (h1 ? 10 : 0) + (summary ? 10 : 0) + (links >= 3 ? 15 : links > 0 ? 8 : 0) + (hasFull ? 15 : 0);
    const gaps = [
      h1 ? "" : "start with an H1 product name (# Name)",
      summary ? "" : "add a one-paragraph > summary under the title",
      links >= 3 ? "" : "link at least three key docs pages as markdown links",
      hasFull ? "" : "publish /llms-full.txt with the full docs inlined",
    ].filter(Boolean);
    return outcome(
      score,
      `/llms.txt found (${body.length} chars, ${links} link(s)).${hasFull ? " /llms-full.txt found." : " No /llms-full.txt."}`,
      gaps.length ? `Improve llms.txt: ${gaps.join("; ")}.` : null,
    );
  },
};

const LOC = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
const normalizePath = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export const sitemapCheck: Check = {
  id: "sitemap",
  title: "Sitemap",
  run: (s) => {
    const sm = s.sitemap;
    if (!sm) return outcome(null, "Not fetched.", null);
    const skip = skipReason(sm);
    if (skip) return outcome(null, `Could not check the sitemap: ${skip}.`, null);
    const where = s.sitemapFromRobots ? `${clip(sm.url)} (from robots.txt)` : "/sitemap.xml";
    const isIndex = /<sitemapindex\b/i.test(sm.body);
    if (!isOk(sm) || !(isIndex || /<urlset\b/i.test(sm.body)))
      return outcome(
        0,
        `No valid XML sitemap at ${where}${sm.error ? ` (${sm.error})` : isOk(sm) ? " (not a urlset or sitemapindex)" : ` (HTTP ${sm.status})`}.`,
        "Publish /sitemap.xml listing your key pages and reference it from robots.txt with a Sitemap: line.",
      );
    const locs = [...sm.body.matchAll(LOC)].map((m) => m[1]!);
    if (locs.length === 0) return outcome(40, `Sitemap at ${where} has no <loc> entries.`, "List your key pages in the sitemap.");
    const listedPaths = new Set(
      locs.flatMap((l) => {
        try {
          return [normalizePath(new URL(l, s.origin).pathname)];
        } catch {
          return [];
        }
      }),
    );
    const missing = isIndex ? [] : s.pages.map((p) => p.path).filter((p) => !listedPaths.has(normalizePath(p)));
    const score = 70 + (s.sitemapFromRobots ? 15 : 0) + (missing.length === 0 ? 15 : 0);
    const fixes = [
      s.sitemapFromRobots ? "" : "Reference the sitemap from robots.txt with a Sitemap: line.",
      missing.length ? `Add these key pages to the sitemap: ${missing.join(", ")}.` : "",
    ].filter(Boolean);
    return outcome(
      score,
      `${isIndex ? "Sitemap index" : "Sitemap"} at ${where} with ${locs.length} entr${locs.length === 1 ? "y" : "ies"}.${missing.length ? ` ${missing.length} key page(s) not listed.` : ""}`,
      fixes.length ? fixes.join(" ") : null,
    );
  },
};
