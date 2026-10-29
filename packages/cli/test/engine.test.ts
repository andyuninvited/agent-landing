import { describe, expect, it } from "vitest";
import { featureScoring } from "../../../lib/data.js";
import { computeScore as siteComputeScore, verdictFor as siteVerdictFor } from "../../../lib/scoring.js";
import { DEFAULT_SCORE_CONFIG, scoreConfigSchema } from "../src/config.js";
import { examplePath } from "../src/example.js";
import { computeScore, headlineFor, normalize, scoreRows, verdictFor } from "../src/score/engine.js";
import { loadData } from "../src/score/ingest.js";

const exampleCfg = scoreConfigSchema.parse(DEFAULT_SCORE_CONFIG);

describe("scoring math", () => {
  it("is a weight-normalized average, rounded", () => {
    expect(computeScore([{ value: 100, weight: 1 }, { value: 0, weight: 3 }])).toBe(25);
    expect(computeScore([{ value: 50, weight: 0 }])).toBe(0);
  });

  it("normalizes identity, linear in both directions, and booleans", () => {
    expect(normalize(140, { type: "identity" })).toBe(100);
    expect(normalize(5, { type: "linear", min: 0, max: 20, direction: "higher" })).toBe(25);
    expect(normalize(5, { type: "linear", min: 0, max: 20, direction: "lower" })).toBe(75);
    expect(normalize(40, { type: "linear", min: 0, max: 20, direction: "lower" })).toBe(0);
    expect(normalize(1, { type: "boolean", good: true })).toBe(100);
    expect(normalize(1, { type: "boolean", good: false })).toBe(0);
  });

  it("picks the highest step a score reaches", () => {
    const ladder = exampleCfg.lenses[0]!.verdicts!;
    expect(verdictFor(29, ladder).label).toBe("Can't see it");
    expect(verdictFor(30, ladder).label).toBe("At risk");
    expect(verdictFor(70, ladder).label).toBe("Landed");
  });
});

describe("score --example matches the demo site", () => {
  it("reproduces lib/scoring.ts scores and verdicts for every feature and lens", async () => {
    const report = scoreRows(await loadData(examplePath()), exampleCfg);
    featureScoring.forEach((f) => {
      const result = report.features.find((r) => r.feature === f.id)!;
      (["human", "agent"] as const).forEach((lens) => {
        const weights = Object.fromEntries(f[lens].signals.map((s) => [s.key, s.weight]));
        const siteScore = siteComputeScore(f[lens].signals, weights);
        const ours = result.lenses.find((l) => l.id === lens)!;
        expect(ours.score).toBe(siteScore);
        expect(ours.verdict?.label).toBe(siteVerdictFor(siteScore, lens).label);
      });
    });
  });

  it("explains each launch the way the Ask panel does", async () => {
    const report = scoreRows(await loadData(examplePath()), exampleCfg);
    const by = (id: string) => report.features.find((f) => f.feature === id)!;
    expect(by("feature-analytics-v2").headline).toMatch(/^Yes and no\./);
    expect(by("sdk-v4").headline).toMatch(/^Mostly\./);
    expect(by("auth-refactor").headline).toMatch(/^Not yet\./);
    expect(by("auth-refactor").alerts.map((a) => a.message)).toEqual([
      "Retry rate spiked to 11.7%. A human-adoption dashboard would have called this a win and missed the failure.",
    ]);
    expect(by("sdk-v4").alerts).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});

describe("generic scoring", () => {
  const cfg = scoreConfigSchema.parse({
    format: "long",
    columns: { feature: "launch", signal: "metric", value: "v" },
    aggregate: "mean",
    lenses: [
      { id: "agent", label: "Agent lens" },
      { id: "partner", label: "Partner lens", verdicts: [{ min: 60, label: "Shipped", tone: "landed" }, { min: 0, label: "Stalled", tone: "risk" }] },
    ],
    signals: [
      { key: "ttfd_s", label: "Seconds to first deploy", lens: "agent", weight: 2, normalize: { type: "linear", min: 10, max: 120, direction: "lower" } },
      { key: "success", label: "Agent success", lens: "agent", weight: 1, normalize: { type: "boolean" } },
      { key: "installs", label: "Partner installs", lens: "partner", weight: 1, normalize: { type: "linear", min: 0, max: 100 }, alert: { when: "below", value: 10 } },
    ],
  });

  it("aggregates long-format events with mapped columns and custom lenses", () => {
    const report = scoreRows(
      [
        { launch: "x", metric: "ttfd_s", v: 10 },
        { launch: "x", metric: "ttfd_s", v: 32 },
        { launch: "x", metric: "success", v: true },
        { launch: "x", metric: "installs", v: 5 },
        { launch: "x", metric: "mystery", v: 1 },
        { launch: null, metric: "ttfd_s", v: 1 },
        { launch: "x", metric: "installs", v: "lots" },
      ],
      cfg,
    );
    const x = report.features[0]!;
    // mean ttfd 21s -> 90 health (w2), success 100 (w1) -> 93
    expect(x.lenses[0]!.score).toBe(93);
    expect(x.lenses[1]!.verdict?.label).toBe("Stalled");
    expect(x.headline).toMatch(/^Not yet\. It looks landed under the Agent lens, but it is at risk under the Partner lens\./);
    expect(x.alerts[0]!.message).toBe("Partner installs is below the alert threshold (5 vs 10).");
    expect(report.warnings).toEqual([
      '1 row(s) had no "launch" value and were skipped',
      "1 value(s) were not numeric or boolean and were skipped",
      "Signals not in config were ignored: mystery",
    ]);
  });

  it("scores only present signals and lists the missing ones", () => {
    const report = scoreRows([{ launch: "y", metric: "success", v: false }], cfg);
    const y = report.features[0]!;
    expect(y.lenses[0]!.score).toBe(0);
    expect(y.lenses[0]!.missing).toEqual(["ttfd_s"]);
    expect(y.lenses[1]!.score).toBeNull();
  });

  it("reads wide rows through signalColumns", () => {
    const wide = scoreConfigSchema.parse({ ...DEFAULT_SCORE_CONFIG, signalColumns: { agent_integration: "Agent Integration %" } });
    const report = scoreRows([{ feature: "z", "Agent Integration %": 90 }], wide);
    expect(report.features[0]!.lenses.find((l) => l.id === "agent")!.score).toBe(90);
  });

  it("writes a headline for every tone mix", () => {
    const lens = (label: string, tone: "landed" | "mixed" | "risk" | "blind") => ({ id: label, label, score: 50, verdict: { label: tone, tone }, signals: [], missing: [] });
    expect(headlineFor([lens("A", "landed"), lens("B", "landed")])).toMatch(/^Yes\./);
    expect(headlineFor([lens("A", "risk")])).toMatch(/^Not yet\. It is at risk/);
    expect(headlineFor([lens("A", "blind")])).toMatch(/^Can't tell\./);
    expect(headlineFor([lens("A", "mixed"), lens("B", "blind")])).toMatch(/^Mixed signal/);
    expect(headlineFor([])).toMatch(/^No data\./);
  });
});
