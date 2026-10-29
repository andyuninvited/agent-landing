import { isOk, isTextFile, type Probe, type Snapshot } from "../collect.js";
import { anchorHrefs } from "../html.js";
import { clip, fetchedPages, mean, outcome, type Check } from "../types.js";

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const pathOf = (p: Probe): string => new URL(p.url).pathname;

// Text an agent would read to learn about the product: key page HTML plus llms.txt.
const discoveryText = (s: Snapshot): string =>
  [...fetchedPages(s).filter((p) => isOk(p.html)).map((p) => p.html.body), isTextFile(s.llms) ? s.llms!.body : ""].join("\n");

const discoveryLinks = (s: Snapshot): string[] => [
  ...fetchedPages(s).flatMap((p) => (isOk(p.html) ? anchorHrefs(p.html.body) : [])),
  ...(isTextFile(s.llms) ? [...s.llms!.body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!) : []),
];

const isSpec = (p: Probe): boolean => {
  if (!isTextFile(p)) return false;
  const json = parseJson(p.body);
  if (isObject(json)) return typeof json.openapi === "string" || typeof json.swagger === "string";
  return /^\s*["']?(openapi|swagger)["']?\s*:/m.test(p.body);
};

const isApiCatalog = (p: Probe): boolean => {
  if (!isTextFile(p)) return false;
  const json = parseJson(p.body);
  return isObject(json) && Array.isArray(json.linkset);
};

const SPEC_LINK = /(openapi|swagger)[^\s"'<>]*\.(json|ya?ml)(\?|#|$)/i;
const DOCS_LINK = /\/(api|apis|developers?|reference|api-docs|api-reference)(\/|$|[?#])|api[-_]?(docs|reference)/i;

export const apiDocsCheck: Check = {
  id: "api-docs",
  title: "OpenAPI and API docs discoverability",
  run: (s) => {
    const spec = s.apiProbes.find(isSpec);
    const catalog = s.apiProbes.find(isApiCatalog);
    const probed = s.apiProbes.filter((p) => !p.skipped).map(pathOf);
    const links = discoveryLinks(s);
    const specLink = links.find((l) => SPEC_LINK.test(l));
    const docsLink = links.find((l) => DOCS_LINK.test(l));
    const noApiNote = 'If the product has no API, disable this check in config ("api-docs": { "enabled": false }).';
    if (spec)
      return outcome(
        catalog ? 100 : 95,
        `Machine-readable API spec at ${pathOf(spec)}.${catalog ? " /.well-known/api-catalog found." : ""}`,
        catalog ? null : "Add /.well-known/api-catalog (RFC 9727) pointing at the spec so agents can find every API from one URL.",
      );
    if (catalog) return outcome(90, "/.well-known/api-catalog found (RFC 9727).", "Serve the OpenAPI spec at a stable URL such as /openapi.json too.");
    if (specLink)
      return outcome(80, `Key pages link to an API spec (${clip(specLink)}).`, "Also serve the spec at /openapi.json and list it in llms.txt so agents find it without crawling.");
    if (docsLink)
      return outcome(
        50,
        `Key pages link to API docs (${clip(docsLink)}), but no machine-readable spec was found at ${probed.join(", ") || "the probed paths"}.`,
        `Publish an OpenAPI spec at /openapi.json and link it from your API docs and llms.txt. Agents can call an API they can read a spec for. ${noApiNote}`,
      );
    return outcome(
      0,
      `No API spec at ${probed.join(", ") || "the probed paths"} and no API docs link on key pages or in llms.txt.`,
      `Publish an OpenAPI spec at /openapi.json and link API docs from your homepage and llms.txt. ${noApiNote}`,
    );
  },
};

const MCP_MENTION = /model context protocol|\bmcp server\b|\bmcp\.json\b/i;
const MCP_ENDPOINT = /https?:\/\/(mcp\.[^\s"'<>()]+|[^\s"'<>()]+\/(mcp|sse)\b)/i;

export const mcpCheck: Check = {
  id: "mcp",
  title: "MCP server discoverability",
  run: (s) => {
    const manifest = s.mcpProbes.find((p) => isTextFile(p) && isObject(parseJson(p.body)));
    if (manifest) return outcome(100, `MCP discovery document at ${pathOf(manifest)}.`, null);
    const text = discoveryText(s);
    const mention = MCP_MENTION.test(text);
    const endpoint = MCP_ENDPOINT.exec(text)?.[0];
    const wellKnownFix =
      "Discovery through /.well-known/mcp.json is still a draft proposal, so also document the server URL, transport, and auth in llms.txt and your docs.";
    if (endpoint)
      return outcome(mention ? 75 : 65, `An MCP endpoint is documented (${clip(endpoint)}), but no /.well-known MCP discovery document.`, `Publish /.well-known/mcp.json describing the server. ${wellKnownFix}`);
    if (mention)
      return outcome(45, "Key pages or llms.txt mention MCP, but no endpoint URL or discovery document was found.", `Document the MCP server URL and how to connect on a key page and in llms.txt. ${wellKnownFix}`);
    return outcome(
      0,
      "No MCP server found: no /.well-known MCP document and no mention on key pages or in llms.txt.",
      'If you offer an MCP server, document its URL, transport, and auth in llms.txt and your docs. If you do not, an MCP server is the most direct way for agents like Claude Code to use your product. Disable this check in config ("mcp": { "enabled": false }) if it does not apply.',
    );
  },
};

const LOGIN_PATH = /\/(login|log-in|signin|sign-in|sign_in|auth|sso|session\/new|account\/login|users\/sign_in)(\/|$|\?)/i;
const BOT_CHALLENGE = /cf-chl|challenge-platform|cf_chl_opt|<title>\s*just a moment\.\.\.|attention required! \| cloudflare|px-captcha|_incapsula_resource|captcha-delivery\.com|datadome/i;
const CAPTCHA = /g-recaptcha|recaptcha\/api\.js|hcaptcha\.com|h-captcha|cf-turnstile|challenges\.cloudflare\.com\/turnstile/i;
const PASSWORD_INPUT = /<input\b[^>]*type\s*=\s*["']?password/i;

export const authFrictionCheck: Check = {
  id: "auth-friction",
  title: "Auth, signup, and bot-challenge friction",
  run: (s) => {
    const pages = fetchedPages(s).filter((p) => !p.html.error);
    if (pages.length === 0) return outcome(null, "No key page could be fetched.", null);
    const scored = pages.map((p) => {
      const final = new URL(p.html.finalUrl);
      const body = p.html.body;
      const issues: [string, number][] = [
        [LOGIN_PATH.test(final.pathname) && !LOGIN_PATH.test(p.path) ? `redirects to login (${final.pathname})` : "", 60],
        [p.html.status === 401 || p.html.status === 403 ? `HTTP ${p.html.status}` : "", 60],
        [p.html.status === 429 ? "rate limited (HTTP 429)" : "", 40],
        [BOT_CHALLENGE.test(body) ? "bot challenge page" : "", 70],
        [CAPTCHA.test(body) ? "CAPTCHA widget" : "", 25],
        [PASSWORD_INPUT.test(body) ? "password field on the page" : "", 15],
      ];
      const hits = issues.filter(([label]) => label);
      return { path: p.path, score: Math.max(0, 100 - hits.reduce((n, [, d]) => n + d, 0)), issues: hits.map(([l]) => l) };
    });
    const blocked = scored.filter((p) => p.issues.length > 0);
    return outcome(
      mean(scored.map((p) => p.score)),
      blocked.length
        ? `${blocked.length} of ${scored.length} key page(s) put friction in front of an agent: ${blocked.map((p) => `${p.path} (${p.issues.join(", ")})`).join("; ")}.`
        : `No login walls, bot challenges, or CAPTCHAs on ${scored.length} key page(s).`,
      blocked.length
        ? "Keep docs, pricing, and the product overview public. Let verified AI agents past bot challenges (most WAFs allowlist known agent user agents), and offer API keys or OAuth that an agent can use without a browser CAPTCHA."
        : null,
      scored.map((p) => `${p.path}: ${p.score}${p.issues.length ? ` (${p.issues.join(", ")})` : ""}`),
    );
  },
};
