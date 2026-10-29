// Lightweight extraction from untrusted HTML. Everything here reads markup as text; nothing is executed.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const NON_CONTENT = /<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1\s*>/gi;

export const visibleText = (html: string): string =>
  decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(NON_CONTENT, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

export const wordCount = (text: string): number => (text ? text.split(" ").filter((w) => /\w/.test(w)).length : 0);

export const parseAttributes = (tag: string): Record<string, string> =>
  Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)].map((m) => [
      m[1]!.toLowerCase(),
      decodeEntities(m[2] ?? m[3] ?? m[4] ?? ""),
    ]),
  );

const tags = (html: string, name: string): Record<string, string>[] =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) => parseAttributes(m[0]));

export const title = (html: string): string | null => {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  const t = m ? decodeEntities(m[1]!).replace(/\s+/g, " ").trim() : "";
  return t || null;
};

export const metaContent = (html: string, key: string): string | null => {
  const k = key.toLowerCase();
  const hit = tags(html, "meta").find((a) => (a.name ?? a.property ?? "").toLowerCase() === k);
  return hit?.content?.trim() || null;
};

export const hasH1 = (html: string): boolean =>
  [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].some((m) => visibleText(m[1]!) !== "");

export const linkTags = (html: string): Record<string, string>[] => tags(html, "link");

export const anchorHrefs = (html: string): string[] => tags(html, "a").flatMap((a) => (a.href ? [a.href] : []));

export const jsonLdBlocks = (html: string): string[] =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((m) => /application\/ld\+json/i.test(parseAttributes(m[1]!).type ?? ""))
    .map((m) => m[2]!.trim());

export const scriptCount = (html: string): number => (html.match(/<script\b/gi) ?? []).length;

const EMPTY_MOUNT = /<div\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt|svelte|main)["']?[^>]*>\s*<\/div>/i;
const NEEDS_JS = /<noscript\b[^>]*>[\s\S]*?(enable javascript|javascript (is )?required|requires javascript)[\s\S]*?<\/noscript>/i;

export const looksLikeJsShell = (html: string): boolean => EMPTY_MOUNT.test(html) || NEEDS_JS.test(html);

export const looksLikeHtml = (body: string, contentType: string | undefined): boolean =>
  /text\/html|application\/xhtml/i.test(contentType ?? "") || /^\s*(<!doctype html|<html\b)/i.test(body);
