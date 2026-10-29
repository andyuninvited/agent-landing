import { checkEnabled, checkWeight, type ScanConfig } from "../config.js";
import { computeScore } from "../score/engine.js";
import { apiDocsCheck, authFrictionCheck, mcpCheck } from "./checks/access.js";
import { markdownCheck, pageWeightCheck, ssrCheck, structuredDataCheck } from "./checks/content.js";
import { llmsTxtCheck, robotsCheck, sitemapCheck } from "./checks/discovery.js";
import { collect, type Fetcher } from "./collect.js";
import { safeFetch, type PrivateAllowance } from "./net.js";
import type { Check, CheckResult, CheckStatus, Fix, ScanReport } from "./types.js";

export const CHECKS: Check[] = [
  robotsCheck,
  llmsTxtCheck,
  sitemapCheck,
  ssrCheck,
  markdownCheck,
  structuredDataCheck,
  apiDocsCheck,
  mcpCheck,
  authFrictionCheck,
  pageWeightCheck,
];

const statusFor = (score: number | null): CheckStatus =>
  score === null ? "skip" : score >= 80 ? "pass" : score >= 50 ? "warn" : "fail";

export const normalizeTarget = (input: string): URL => {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`Only http and https URLs can be scanned, got ${url.protocol}`);
  return url;
};

export type ScanOptions = { allowPrivate?: PrivateAllowance; fetcher?: Fetcher; now?: () => Date };

export const runScan = async (input: string, cfg: ScanConfig, opts: ScanOptions = {}): Promise<ScanReport> => {
  const target = normalizeTarget(input);
  const fetcher: Fetcher =
    opts.fetcher ??
    ((url, accept) =>
      safeFetch(url, accept, {
        userAgent: cfg.userAgent,
        timeoutMs: cfg.timeoutMs,
        maxBytes: cfg.maxBytes,
        allowPrivate: opts.allowPrivate ?? false,
      }));
  const snapshot = await collect(target, cfg, fetcher);
  const attempted = [snapshot.robots, ...snapshot.pages.map((p) => p.html)].filter((p) => !p.skipped);
  if (attempted.length > 0 && attempted.every((p) => p.error))
    throw new Error(`Could not reach ${target.origin}: ${attempted[0]!.error}`);

  const checks: CheckResult[] = CHECKS.filter((c) => checkEnabled(cfg, c.id)).map((c) => {
    const result = c.run(snapshot, cfg);
    return { id: c.id, title: c.title, weight: checkWeight(cfg, c.id), status: statusFor(result.score), ...result };
  });

  const scored = checks.filter((c): c is CheckResult & { score: number } => c.score !== null);
  const totalWeight = scored.reduce((n, c) => n + c.weight, 0);
  const fixes: Fix[] = scored
    .filter((c) => c.fix && c.score < 100)
    .map((c) => ({
      check: c.id,
      title: c.title,
      fix: c.fix!,
      score: c.score,
      potentialGain: totalWeight ? Math.round(((100 - c.score) * c.weight) / totalWeight) : 0,
    }))
    .sort((a, b) => b.potentialGain - a.potentialGain || a.score - b.score);

  return {
    url: target.toString(),
    scannedAt: (opts.now ?? (() => new Date()))().toISOString(),
    overall: computeScore(scored.map((c) => ({ value: c.score, weight: c.weight }))),
    checks,
    fixes,
    requestCount: snapshot.requestCount,
    pages: snapshot.pages.map((p) => p.path),
  };
};
