import type { LensSignal } from "./data";

// Composite landing score = weight-normalized average of signal health (0-100).
export function computeScore(
  signals: LensSignal[],
  weights: Record<string, number>,
): number {
  const totalW = signals.reduce((s, sig) => s + (weights[sig.key] ?? 0), 0);
  if (totalW === 0) return 0;
  const sum = signals.reduce(
    (s, sig) => s + sig.value * (weights[sig.key] ?? 0),
    0,
  );
  return Math.round(sum / totalW);
}

export type VerdictTone = "landed" | "mixed" | "risk" | "blind";

export function verdictFor(
  score: number,
  lens: "human" | "agent",
): { label: string; tone: VerdictTone } {
  // Under the human lens, a near-zero score isn't "at risk," it's invisible.
  if (lens === "human" && score < 30) return { label: "Can't see it", tone: "blind" };
  if (score >= 70) return { label: "Landed", tone: "landed" };
  if (score >= 45) return { label: "Mixed signal", tone: "mixed" };
  return { label: "At risk", tone: "risk" };
}
