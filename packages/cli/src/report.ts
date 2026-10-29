import type { ScoreReport } from "./score/engine.js";
import type { CheckStatus, ScanReport } from "./scan/types.js";

export type Format = "terminal" | "json" | "md";

// Report text can carry strings from fetched pages or data files; never let them emit terminal escapes.
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const safe = (s: string): string => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");

const paint = (color: boolean) => (code: string, s: string) => (color ? `\u001b[${code}m${s}\u001b[0m` : s);

const statusColor: Record<CheckStatus, string> = { pass: "32", warn: "33", fail: "31", skip: "90" };
const toneColor: Record<string, string> = { landed: "32", mixed: "33", risk: "31", blind: "90" };

const pad = (s: string, n: number): string => (s.length >= n ? s : s + " ".repeat(n - s.length));
const padStart = (s: string, n: number): string => (s.length >= n ? s : " ".repeat(n - s.length) + s);
const mdCell = (s: string): string => safe(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

export const scanToTerminal = (r: ScanReport, color: boolean): string => {
  const c = paint(color);
  const lines = [
    `${c("1", "agent-landing scan")}  ${safe(r.url)}`,
    `Overall ${c("1", `${r.overall}/100`)}  (${r.checks.filter((x) => x.status !== "skip").length} checks scored, ${r.requestCount} requests, pages: ${safe(r.pages.join(", "))})`,
    "",
    ...r.checks.flatMap((x) => [
      `  ${c(statusColor[x.status], pad(x.status.toUpperCase(), 4))} ${padStart(x.score === null ? "-" : String(x.score), 3)}  ${c("1", x.title)}`,
      `            ${safe(x.reason)}`,
    ]),
    "",
    c("1", "Prioritized fixes"),
    ...(r.fixes.length
      ? r.fixes.flatMap((f, i) => [`  ${i + 1}. ${c("1", f.title)} ${c("90", `(score ${f.score}, up to +${f.potentialGain} overall)`)}`, `     ${safe(f.fix)}`])
      : ["  Nothing to fix. Every scored check passed."]),
  ];
  return lines.join("\n");
};

export const scanToMarkdown = (r: ScanReport): string =>
  [
    `# Agent landing scan: ${safe(r.url)}`,
    "",
    `**Overall score: ${r.overall}/100.** Scanned ${r.scannedAt} with ${r.requestCount} requests. Key pages: ${safe(r.pages.join(", "))}.`,
    "",
    "| Check | Status | Score | Weight | Why |",
    "| --- | --- | --- | --- | --- |",
    ...r.checks.map((x) => `| ${x.title} | ${x.status} | ${x.score ?? "-"} | ${x.weight} | ${mdCell(x.reason)} |`),
    "",
    "## Prioritized fixes",
    "",
    ...(r.fixes.length
      ? r.fixes.map((f, i) => `${i + 1}. **${f.title}** (score ${f.score}, up to +${f.potentialGain} overall). ${safe(f.fix)}`)
      : ["Nothing to fix. Every scored check passed."]),
    "",
    "## Details",
    "",
    ...r.checks.flatMap((x) => (x.details.length ? [`**${x.title}**`, "", ...x.details.map((d) => `- ${safe(d)}`), ""] : [])),
  ].join("\n");

export const scoreToTerminal = (r: ScoreReport, source: string, color: boolean): string => {
  const c = paint(color);
  const width = Math.max(...r.features.flatMap((f) => f.lenses.map((l) => l.label.length)), 10);
  return [
    `${c("1", "agent-landing score")}  ${safe(source)}`,
    ...r.warnings.map((w) => c("33", `warning: ${safe(w)}`)),
    ...r.features.flatMap((f) => [
      "",
      c("1", safe(f.feature)),
      `  ${safe(f.headline)}`,
      ...f.lenses.map((l) =>
        l.score === null || l.verdict === null
          ? `  ${pad(safe(l.label), width)}    -  no data`
          : `  ${pad(safe(l.label), width)}  ${padStart(String(l.score), 3)}/100  ${c(toneColor[l.verdict.tone] ?? "0", safe(l.verdict.label))}`,
      ),
      ...f.alerts.map((a) => `  ${c("31", "alert")} ${safe(a.message)}`),
      ...f.lensNotes.map((n) => `  ${c("90", safe(n))}`),
    ]),
  ].join("\n");
};

export const scoreToMarkdown = (r: ScoreReport, source: string): string => {
  const lensIds = r.features[0]?.lenses.map((l) => l.label) ?? [];
  return [
    `# Landing scorecard: ${safe(source)}`,
    "",
    ...r.warnings.map((w) => `> Warning: ${safe(w)}`),
    ...(r.warnings.length ? [""] : []),
    `| Feature | ${lensIds.map(mdCell).join(" | ")} | Verdict |`,
    `| --- | ${lensIds.map(() => "---").join(" | ")} | --- |`,
    ...r.features.map(
      (f) =>
        `| ${mdCell(f.feature)} | ${f.lenses.map((l) => (l.score === null ? "no data" : `${l.score} ${mdCell(l.verdict!.label)}`)).join(" | ")} | ${mdCell(f.headline)} |`,
    ),
    "",
    ...r.features.flatMap((f) => [`## ${safe(f.feature)}`, "", safe(f.explanation), ""]),
  ].join("\n");
};
