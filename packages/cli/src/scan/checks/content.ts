import { isOk, isTextFile, type PageSnapshot } from "../collect.js";
import { hasH1, jsonLdBlocks, linkTags, looksLikeJsShell, metaContent, title, visibleText, wordCount } from "../html.js";
import { fetchedPages, fmtTokens, mean, outcome, type Check, type CheckOutcome } from "../types.js";

type PageScore = { path: string; score: number; note: string };

const perPage = (
  pages: PageSnapshot[],
  scorePage: (p: PageSnapshot) => PageScore | null,
  summarize: (scored: PageScore[]) => Omit<CheckOutcome, "details" | "score">,
): CheckOutcome => {
  const scored = pages.flatMap((p) => {
    const r = scorePage(p);
    return r ? [r] : [];
  });
  if (scored.length === 0) return outcome(null, "No key page could be fetched successfully.", null);
  const { reason, fix } = summarize(scored);
  return outcome(mean(scored.map((p) => p.score)), reason, fix, scored.map((p) => `${p.path}: ${p.score} (${p.note})`));
};

const httpFailure = (p: PageSnapshot): PageScore | null =>
  isOk(p.html) ? null : { path: p.path, score: 0, note: p.html.error ?? `HTTP ${p.html.status}` };

export const ssrCheck: Check = {
  id: "ssr-readable",
  title: "Server-rendered readable HTML",
  run: (s) =>
    perPage(
      fetchedPages(s),
      (p) => {
        const failed = httpFailure(p);
        if (failed) return failed;
        const html = p.html.body;
        const words = wordCount(visibleText(html));
        const shell = looksLikeJsShell(html);
        const base = words >= 150 ? 70 : words >= 50 ? 45 : 10;
        const extras = (title(html) ? 10 : 0) + (metaContent(html, "description") ? 10 : 0) + (hasH1(html) ? 10 : 0);
        return {
          path: p.path,
          score: Math.min(100, base + extras - (shell && words < 50 ? 10 : 0)),
          note: `${words} words without JS${shell ? ", empty JS mount point" : ""}${title(html) ? "" : ", no <title>"}${metaContent(html, "description") ? "" : ", no meta description"}${hasH1(html) ? "" : ", no <h1>"}`,
        };
      },
      (scored) => {
        const thin = scored.filter((p) => p.score < 50).map((p) => p.path);
        return {
          reason: thin.length
            ? `${thin.length} of ${scored.length} key page(s) are thin or JS-only for a client that does not run JavaScript: ${thin.join(", ")}.`
            : `All ${scored.length} key page(s) return readable HTML without running JavaScript.`,
          fix: thin.length
            ? `Server-render or statically generate ${thin.join(", ")} so the main content, <title>, meta description, and <h1> are in the initial HTML. Most agents fetch HTML and never run your bundle.`
            : scored.some((p) => p.score < 100)
              ? "Add a <title>, meta description, and <h1> to every key page."
              : null,
        };
      },
    ),
};

const markdownAdvertised = (html: string): boolean =>
  linkTags(html).some((l) => /\balternate\b/i.test(l.rel ?? "") && /text\/(x-)?markdown/i.test(l.type ?? ""));

export const markdownAvailable = (p: PageSnapshot): { negotiated: boolean; variant: boolean } => ({
  negotiated: isTextFile(p.markdownNegotiated),
  variant: isTextFile(p.markdownVariant),
});

export const markdownCheck: Check = {
  id: "markdown",
  title: "Markdown versions of key pages",
  run: (s) =>
    perPage(
      fetchedPages(s),
      (p) => {
        const { negotiated, variant } = markdownAvailable(p);
        const advertised = isOk(p.html) && markdownAdvertised(p.html.body);
        const served = negotiated || variant;
        const ways = [negotiated ? "Accept: text/markdown" : "", variant ? ".md URL" : "", advertised ? "advertised via <link rel=alternate>" : ""].filter(Boolean);
        return {
          path: p.path,
          score: served ? (advertised ? 100 : 85) : advertised ? 50 : 0,
          note: ways.length ? ways.join(", ") : "no markdown",
        };
      },
      (scored) => {
        const none = scored.filter((p) => p.score === 0).map((p) => p.path);
        const unadvertised = scored.filter((p) => p.score === 85).map((p) => p.path);
        return {
          reason: none.length
            ? `${none.length} of ${scored.length} key page(s) have no markdown version: ${none.join(", ")}.`
            : `Every key page has a markdown version.`,
          fix: none.length
            ? "Serve markdown for key pages, either at the same path plus .md or when the request sends Accept: text/markdown, and advertise it with <link rel=\"alternate\" type=\"text/markdown\" href=\"...\">. Markdown cuts token cost and removes layout noise for agents."
            : unadvertised.length
              ? `Advertise the markdown versions of ${unadvertised.join(", ")} with <link rel="alternate" type="text/markdown">.`
              : null,
        };
      },
    ),
};

const ldTypes = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(ldTypes);
  if (typeof node !== "object" || node === null) return [];
  const obj = node as Record<string, unknown>;
  const own = typeof obj["@type"] === "string" ? [obj["@type"]] : Array.isArray(obj["@type"]) ? obj["@type"].filter((t): t is string => typeof t === "string") : [];
  return [...own, ...ldTypes(obj["@graph"])];
};

export const structuredDataCheck: Check = {
  id: "structured-data",
  title: "Structured data (JSON-LD)",
  run: (s) =>
    perPage(
      fetchedPages(s),
      (p) => {
        if (!isOk(p.html)) return null;
        const blocks = jsonLdBlocks(p.html.body);
        const parsed = blocks.map((b) => {
          try {
            return { ok: true, types: ldTypes(JSON.parse(b) as unknown) };
          } catch {
            return { ok: false, types: [] as string[] };
          }
        });
        const types = parsed.flatMap((b) => b.types);
        const invalid = parsed.filter((b) => !b.ok).length;
        const og = !!metaContent(p.html.body, "og:title");
        const score = types.length > 0 ? 100 - invalid * 20 : og ? 40 : invalid ? 10 : 0;
        return {
          path: p.path,
          score,
          note: types.length ? `JSON-LD: ${[...new Set(types)].join(", ")}` : og ? "OpenGraph only" : "none",
        };
      },
      (scored) => {
        const lacking = scored.filter((p) => p.score < 100).map((p) => p.path);
        return {
          reason: lacking.length
            ? `${lacking.length} of ${scored.length} key page(s) lack valid JSON-LD: ${lacking.join(", ")}.`
            : "Every key page has valid JSON-LD.",
          fix: lacking.length
            ? `Add schema.org JSON-LD to ${lacking.join(", ")} (for example Organization, SoftwareApplication or Product with offers, and TechArticle for docs) and fix any blocks that fail to parse.`
            : null,
        };
      },
    ),
};

const tokens = (chars: number): number => Math.ceil(chars / 4);

const weightScore = (t: number): number =>
  t <= 8_000 ? 100 : t <= 20_000 ? 85 : t <= 50_000 ? 65 : t <= 100_000 ? 40 : t <= 200_000 ? 20 : 5;

export const pageWeightCheck: Check = {
  id: "page-weight",
  title: "Page weight and token cost",
  run: (s) =>
    perPage(
      fetchedPages(s),
      (p) => {
        if (!isOk(p.html)) return null;
        if (p.html.truncated) return { path: p.path, score: 5, note: `over the ${p.html.bytes} byte cap` };
        const htmlTokens = tokens(p.html.body.length);
        const textTokens = tokens(visibleText(p.html.body).length);
        const md = [p.markdownNegotiated, p.markdownVariant].flatMap((m) => (m && isTextFile(m) ? [tokens(m.body.length)] : []));
        const best = md.length ? Math.min(...md) : htmlTokens;
        const ratio = htmlTokens ? Math.round((textTokens / htmlTokens) * 100) : 0;
        return {
          path: p.path,
          score: weightScore(best),
          note: `~${fmtTokens(htmlTokens)} tokens of HTML for ~${fmtTokens(textTokens)} tokens of text (${ratio}% signal)${md.length ? `, markdown ~${fmtTokens(best)}` : ""}`,
        };
      },
      (scored) => {
        const heavy = scored.filter((p) => p.score < 85).map((p) => p.path);
        return {
          reason: heavy.length
            ? `${heavy.length} of ${scored.length} key page(s) cost over 20k tokens for an agent to read: ${heavy.join(", ")}.`
            : `Key pages are light enough to read in one pass.`,
          fix: heavy.length
            ? `Cut the token cost of ${heavy.join(", ")}: serve a markdown version, move inline scripts, styles, and SVG out of the HTML, and avoid large inlined JSON state.`
            : null,
        };
      },
    ),
};
