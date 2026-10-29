import type { CheckId, ScanConfig } from "../config.js";
import type { PageSnapshot, Snapshot } from "./collect.js";

export type CheckOutcome = {
  score: number | null;
  reason: string;
  fix: string | null;
  details: string[];
};

export type Check = {
  id: CheckId;
  title: string;
  run: (s: Snapshot, cfg: ScanConfig) => CheckOutcome;
};

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export type CheckResult = CheckOutcome & { id: CheckId; title: string; weight: number; status: CheckStatus };

export type Fix = { check: CheckId; title: string; fix: string; score: number; potentialGain: number };

export type ScanReport = {
  url: string;
  scannedAt: string;
  overall: number;
  checks: CheckResult[];
  fixes: Fix[];
  requestCount: number;
  pages: string[];
};

export const outcome = (score: number | null, reason: string, fix: string | null, details: string[] = []): CheckOutcome => ({
  score: score === null ? null : Math.max(0, Math.min(100, Math.round(score))),
  reason,
  fix,
  details,
});

export const skipReason = (p: { skipped?: "robots" | "budget"; error?: string }): string | null =>
  p.skipped === "robots"
    ? "robots.txt disallows agent-landing from fetching it"
    : p.skipped === "budget"
      ? "request budget (maxRequests) exhausted"
      : null;

// Pages whose HTML we were allowed and able to request.
export const fetchedPages = (s: Snapshot): PageSnapshot[] => s.pages.filter((p) => !p.html.skipped);

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export const fmtTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// Strings lifted from fetched pages are untrusted: strip control characters and cap their length.
export const clip = (s: string, max = 120): string => {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const clean = s.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
};
