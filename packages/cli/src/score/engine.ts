import type { Lens, ScoreConfig, Signal, VerdictStep, VerdictTone } from "../config.js";
import type { Cell, Row } from "./ingest.js";

export type WeightedValue = { value: number; weight: number };

// Composite landing score = weight-normalized average of signal health (0-100), as in lib/scoring.ts.
export const computeScore = (items: WeightedValue[]): number => {
  const totalW = items.reduce((s, it) => s + it.weight, 0);
  if (totalW === 0) return 0;
  return Math.round(items.reduce((s, it) => s + it.value * it.weight, 0) / totalW);
};

export type Verdict = { label: string; tone: VerdictTone };

export const verdictFor = (score: number, ladder: VerdictStep[]): Verdict => {
  const step = [...ladder].sort((a, b) => b.min - a.min).find((s) => score >= s.min);
  return step ? { label: step.label, tone: step.tone } : { label: "Unrated", tone: "risk" };
};

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

export const normalize = (raw: number, n: Signal["normalize"]): number => {
  switch (n.type) {
    case "identity":
      return clamp(raw);
    case "boolean":
      return (raw !== 0) === n.good ? 100 : 0;
    case "linear": {
      const t = ((raw - n.min) / (n.max - n.min)) * 100;
      return clamp(n.direction === "higher" ? t : 100 - t);
    }
  }
};

const aggregators: Record<ScoreConfig["aggregate"], (xs: number[]) => number> = {
  mean: (xs) => xs.reduce((a, b) => a + b, 0) / xs.length,
  sum: (xs) => xs.reduce((a, b) => a + b, 0),
  min: (xs) => Math.min(...xs),
  max: (xs) => Math.max(...xs),
  last: (xs) => xs[xs.length - 1]!,
};

const toNumber = (c: Cell | undefined): number | null =>
  typeof c === "number" ? c : typeof c === "boolean" ? (c ? 1 : 0) : null;

type Extracted = { values: Map<string, Map<string, number[]>>; warnings: string[] };

const push = (values: Map<string, Map<string, number[]>>, feature: string, key: string, v: number): void => {
  const bySignal = values.get(feature) ?? new Map<string, number[]>();
  bySignal.set(key, [...(bySignal.get(key) ?? []), v]);
  values.set(feature, bySignal);
};

export const extractValues = (rows: Row[], cfg: ScoreConfig): Extracted => {
  const values = new Map<string, Map<string, number[]>>();
  const warnings: string[] = [];
  const known = new Set(cfg.signals.map((s) => s.key));
  const unknownSignals = new Set<string>();
  let nonNumeric = 0;
  let noFeature = 0;

  rows.forEach((row) => {
    const featureCell = row[cfg.columns.feature];
    if (featureCell === null || featureCell === undefined || featureCell === "") {
      noFeature += 1;
      return;
    }
    const feature = String(featureCell);
    if (cfg.format === "long") {
      const key = row[cfg.columns.signal];
      if (key === null || key === undefined) return;
      if (!known.has(String(key))) {
        unknownSignals.add(String(key));
        return;
      }
      const v = toNumber(row[cfg.columns.value]);
      if (v === null) nonNumeric += 1;
      else push(values, feature, String(key), v);
      return;
    }
    if (!values.has(feature)) values.set(feature, new Map());
    cfg.signals.forEach((s) => {
      const cell = row[cfg.signalColumns[s.key] ?? s.key];
      if (cell === null || cell === undefined) return;
      const v = toNumber(cell);
      if (v === null) nonNumeric += 1;
      else push(values, feature, s.key, v);
    });
  });

  if (noFeature > 0) warnings.push(`${noFeature} row(s) had no "${cfg.columns.feature}" value and were skipped`);
  if (nonNumeric > 0) warnings.push(`${nonNumeric} value(s) were not numeric or boolean and were skipped`);
  if (unknownSignals.size > 0)
    warnings.push(`Signals not in config were ignored: ${[...unknownSignals].sort().join(", ")}`);
  return { values, warnings };
};

export type SignalResult = { key: string; label: string; raw: number; health: number; weight: number };
export type LensResult = {
  id: string;
  label: string;
  score: number | null;
  verdict: Verdict | null;
  signals: SignalResult[];
  missing: string[];
};
export type Alert = { signal: string; message: string };
export type FeatureResult = {
  feature: string;
  lenses: LensResult[];
  alerts: Alert[];
  headline: string;
  lensNotes: string[];
  explanation: string;
};
export type ScoreReport = { features: FeatureResult[]; warnings: string[] };

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

const renderTemplate = (tpl: string, vars: Record<string, string>): string =>
  tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

const alertFor = (s: Signal, raw: number): Alert | null => {
  if (!s.alert) return null;
  const tripped = s.alert.when === "above" ? raw > s.alert.value : raw < s.alert.value;
  if (!tripped) return null;
  const tpl = s.alert.message ?? `{label} is ${s.alert.when} the alert threshold ({value} vs {threshold}).`;
  return { signal: s.key, message: renderTemplate(tpl, { label: s.label, value: fmt(raw), threshold: fmt(s.alert.value) }) };
};

const scoreLens = (lens: Lens, cfg: ScoreConfig, raw: Map<string, number>): LensResult => {
  const lensSignals = cfg.signals.filter((s) => s.lens === lens.id);
  const signals = lensSignals.flatMap((s): SignalResult[] => {
    const v = raw.get(s.key);
    return v === undefined ? [] : [{ key: s.key, label: s.label, raw: v, health: Math.round(normalize(v, s.normalize)), weight: s.weight }];
  });
  const missing = lensSignals.filter((s) => s.weight > 0 && !raw.has(s.key)).map((s) => s.key);
  const scored = signals.filter((s) => s.weight > 0);
  const score = scored.length === 0 ? null : computeScore(scored.map((s) => ({ value: s.health, weight: s.weight })));
  return {
    id: lens.id,
    label: lens.label,
    score,
    verdict: score === null ? null : verdictFor(score, lens.verdicts ?? cfg.verdicts),
    signals,
    missing,
  };
};

const listLabels = (lenses: LensResult[]): string => {
  const names = lenses.map((l) => `the ${l.label}`);
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

export const headlineFor = (lenses: LensResult[]): string => {
  const rated = lenses.filter((l) => l.verdict !== null);
  if (rated.length === 0) return "No data. None of the configured signals were found for this feature.";
  const byTone = (t: VerdictTone) => rated.filter((l) => l.verdict!.tone === t);
  const landed = byTone("landed");
  const risk = byTone("risk");
  const blind = byTone("blind");
  const mixed = byTone("mixed");
  if (landed.length === rated.length) return `Yes. It landed under ${listLabels(landed)}.`;
  if (risk.length > 0 && landed.length > 0)
    return `Not yet. It looks landed under ${listLabels(landed)}, but it is at risk under ${listLabels(risk)}.`;
  if (risk.length > 0) return `Not yet. It is at risk under ${listLabels(risk)}.`;
  if (landed.length > 0 && blind.length > 0)
    return `Yes and no. It landed under ${listLabels(landed)}, and ${listLabels(blind)} can't see it.`;
  if (landed.length > 0) return `Mostly. It landed under ${listLabels(landed)}, with a mixed signal under ${listLabels(mixed)}.`;
  if (blind.length === rated.length) return `Can't tell. Every lens reads near zero, so check whether the right users are instrumented.`;
  return `Mixed signal under ${listLabels([...mixed, ...blind])}.`;
};

const lensSentence = (l: LensResult): string => {
  if (l.score === null || l.verdict === null) return `${l.label}: no data.`;
  const scored = [...l.signals].filter((s) => s.weight > 0).sort((a, b) => b.health - a.health);
  const strong = scored.filter((s) => s.health >= 60).slice(0, 2);
  const weak = scored.filter((s) => s.health < 60).slice(-2).reverse();
  const parts = [
    `${l.label}: ${l.score}/100, ${l.verdict.label}.`,
    strong.length ? `Strongest: ${strong.map((s) => `${s.label} (${s.health})`).join(", ")}.` : "",
    weak.length ? `Weakest: ${weak.map((s) => `${s.label} (${s.health})`).join(", ")}.` : "",
    l.missing.length ? `Missing: ${l.missing.join(", ")}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
};

export const scoreRows = (rows: Row[], cfg: ScoreConfig): ScoreReport => {
  const { values, warnings } = extractValues(rows, cfg);
  const features = [...values.entries()].map(([feature, bySignal]): FeatureResult => {
    const raw = new Map([...bySignal.entries()].map(([k, xs]) => [k, aggregators[cfg.aggregate](xs)]));
    const lenses = cfg.lenses.map((lens) => scoreLens(lens, cfg, raw));
    const alerts = cfg.signals.flatMap((s) => {
      const v = raw.get(s.key);
      const a = v === undefined ? null : alertFor(s, v);
      return a ? [a] : [];
    });
    const headline = headlineFor(lenses);
    const alertText = alerts.length ? alerts.map((a) => a.message).join(" ") : "No alerts tripped.";
    const lensNotes = lenses.map(lensSentence);
    return { feature, lenses, alerts, headline, lensNotes, explanation: [headline, ...lensNotes, alertText].join(" ") };
  });
  if (rows.length === 0) warnings.push("The data file has no rows");
  return { features, warnings };
};
