"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { featureScoring } from "@/lib/data";
import { computeScore, verdictFor, type VerdictTone } from "@/lib/scoring";

type Lens = "human" | "agent";

const toneStyles: Record<VerdictTone, { text: string; bg: string; ring: string }> = {
  landed: { text: "text-success-green", bg: "bg-success-green/10", ring: "ring-success-green/30" },
  mixed: { text: "text-warning-orange", bg: "bg-warning-orange/10", ring: "ring-warning-orange/30" },
  risk: { text: "text-error", bg: "bg-error/10", ring: "ring-error/30" },
  blind: { text: "text-outline", bg: "bg-surface-container", ring: "ring-outline/20" },
};

function defaultWeights(featureId: string, lens: Lens): Record<string, number> {
  const set = featureScoring.find((f) => f.id === featureId)![lens];
  return Object.fromEntries(set.signals.map((s) => [s.key, s.weight]));
}

export function LandingLens() {
  const [lens, setLens] = useState<Lens>("agent");
  const [featureId, setFeatureId] = useState(featureScoring[0].id);
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    defaultWeights(featureScoring[0].id, "agent"),
  );

  // Reset weights whenever the lens or feature changes.
  useEffect(() => {
    setWeights(defaultWeights(featureId, lens));
  }, [featureId, lens]);

  const feature = featureScoring.find((f) => f.id === featureId)!;
  const view = feature[lens];
  const score = useMemo(() => computeScore(view.signals, weights), [view, weights]);
  const verdict = verdictFor(score, lens);
  const tone = toneStyles[verdict.tone];
  const blind = lens === "human" && score < 20;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-[22px] font-semibold text-on-surface">
          Did it land? It depends on the lens.
        </h2>
        <p className="text-[13px] text-on-surface-variant mt-1 max-w-2xl">
          The same launch, scored two ways. Drag the weights to argue for any
          metric you like. Under the human-adoption lens, an agent-driven launch
          stays invisible no matter how you weight it, because the user who
          adopted it isn&apos;t human.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-surface-container rounded-lg p-0.5 gap-0.5">
          {(
            [
              { id: "human", label: "Human-adoption lens", icon: EyeOff },
              { id: "agent", label: "Agent-as-user lens", icon: Eye },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setLens(opt.id)}
              className={
                "px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 " +
                (lens === opt.id
                  ? "bg-surface-white shadow-sm text-primary"
                  : "text-on-surface-variant hover:text-on-surface")
              }
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {featureScoring.map((f) => (
            <button
              key={f.id}
              onClick={() => setFeatureId(f.id)}
              className={
                "px-3 py-1.5 rounded-full text-[11px] font-mono border transition-colors " +
                (featureId === f.id
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-white text-on-surface-variant border-border-subtle hover:border-outline-variant")
              }
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Verdict */}
        <div
          className={
            "bg-surface-white border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col justify-between ring-1 " +
            tone.ring
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Landing score
            </span>
            <span
              className={"text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full " + tone.bg + " " + tone.text}
            >
              {verdict.label}
            </span>
          </div>
          <div className="my-3">
            <span className={"font-display text-6xl font-bold " + tone.text}>
              {score}
            </span>
            <span className="text-2xl font-bold text-outline">/100</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className={
                "h-full rounded-full transition-all duration-300 " +
                (verdict.tone === "landed"
                  ? "bg-success-green"
                  : verdict.tone === "mixed"
                    ? "bg-warning-orange"
                    : verdict.tone === "risk"
                      ? "bg-error"
                      : "bg-outline/40")
              }
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="text-[12px] text-on-surface-variant mt-3 leading-relaxed">
            {view.takeaway}
          </p>
          {blind && (
            <p className="text-[11px] font-semibold text-on-surface mt-3 bg-surface-container rounded-lg px-3 py-2 border border-border-subtle">
              Drag all you want. The old lens can&apos;t weight what it can&apos;t
              see.
            </p>
          )}
        </div>

        {/* Signals + weights */}
        <div className="bg-surface-white border border-border-subtle rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {lens === "agent" ? "Agent-native signals" : "Human-adoption signals"} · weight them
            </span>
            <button
              onClick={() => setWeights(defaultWeights(featureId, lens))}
              className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant hover:text-on-surface flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          <div className="space-y-3.5">
            {view.signals.map((sig) => (
              <div key={sig.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center">
                <span className="text-[12px] text-on-surface">{sig.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className={
                        "h-full rounded-full " +
                        (sig.value >= 60
                          ? "bg-success-green"
                          : sig.value >= 30
                            ? "bg-warning-orange"
                            : "bg-error")
                      }
                      style={{ width: `${sig.value}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-on-surface-variant w-7 text-right">
                    {sig.value}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[sig.key] ?? 0}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [sig.key]: Number(e.target.value) }))
                  }
                  aria-label={`Weight for ${sig.label}`}
                  className="col-span-2 w-full accent-electric-purple cursor-pointer h-1"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
