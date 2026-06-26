// Local reasoning for the "Ask the framework" panel. Deterministic, runs over
// the synthetic dataset, costs nothing, and is safe to expose publicly. A live
// Claude model can be dropped in behind this same shape (see app/api/ask) by
// flipping ASK_LIVE on - kept off by default so the public demo has no paid,
// abusable endpoint.

import {
  features,
  rhythmStrip,
  headlineStats,
  type FeatureRecord,
  type RhythmDay,
} from "./data";

export type Verdict = {
  question: string;
  answer: string;
  source: string;
  tone: "landed" | "mixed" | "at-risk" | "info";
};

const humanAdoptionPhrase: Record<FeatureRecord["humanAdoption"], string> = {
  flat: "Initial human adoption is flat",
  moderate: "Human adoption is moderate",
  strong: "Human adoption is strong",
};

const reusePhrase: Record<FeatureRecord["downstreamReuse"], string> = {
  none: "No downstream reuse yet",
  growing: "Downstream reuse is growing",
  strong: "Downstream reuse is strong",
};

function findFeature(q: string): FeatureRecord | undefined {
  const lower = q.toLowerCase();
  return (
    features.find((f) => lower.includes(f.id.toLowerCase())) ??
    features.find((f) =>
      f.name
        .toLowerCase()
        .split(/[-\s]/)
        .some((tok) => tok.length > 2 && lower.includes(tok)),
    )
  );
}

function landingVerdict(f: FeatureRecord): Verdict {
  const retry = f.retrySpike
    ? `Retry rate spiked to ${f.retryRatePct}% - a human-adoption dashboard would have called this a win and missed the failure.`
    : `No retry spikes detected (${f.retryRatePct}% retry rate).`;

  const head =
    f.verdict === "landed"
      ? "Yes - it landed for both humans and agents."
      : f.verdict === "landed-agent-only"
        ? "Yes, but only the old framework would say no."
        : "Not yet - it looks adopted but it is at risk.";

  return {
    question: `Did ${f.name} land successfully?`,
    answer: `${head} Deployed at ${f.deployedAt}. ${humanAdoptionPhrase[f.humanAdoption]}, but Claude Code agents integrated it in ${f.agentIntegrationPct}% of active sessions within ${f.windowMins} minutes. ${reusePhrase[f.downstreamReuse]}. ${retry}`,
    source: `source: deploy log + agent-session telemetry for ${f.id}`,
    tone:
      f.verdict === "landed"
        ? "landed"
        : f.verdict === "at-risk"
          ? "at-risk"
          : "mixed",
  };
}

export function askFramework(question: string): Verdict {
  const q = question.trim();
  const lower = q.toLowerCase();

  // Retry-rate question
  if (lower.includes("retry")) {
    const worst = [...features].sort((a, b) => b.retryRatePct - a.retryRatePct)[0];
    return {
      question: q,
      answer: `Across tracked deploys, retry rate runs 2.4% to 11.7%. The outlier is ${worst.name} at ${worst.retryRatePct}% - a retry spike on an otherwise "adopted" feature, which is exactly the signal a human-adoption metric cannot see.`,
      source: "source: agent retry / success telemetry",
      tone: worst.retrySpike ? "at-risk" : "info",
    };
  }

  // Latest deploys question
  if (lower.includes("latest") || lower.includes("deploys") || lower.includes("recent")) {
    const list = features
      .map((f) => `${f.name} (${f.deployedAt}, ${f.agentIntegrationPct}% agent integration)`)
      .join("; ");
    return {
      question: q,
      answer: `Most recent deploys reasoning into the framework: ${list}. Agents now drive ~${headlineStats.agentDeploySharePct}% of all deploys, ${headlineStats.dominantAgent} dominant.`,
      source: "source: deploy log",
      tone: "info",
    };
  }

  // Agent health / rhythm question
  if (lower.includes("health") || lower.includes("rhythm") || lower.includes("cadence")) {
    const active = rhythmStrip.find((d) => d.state === "active");
    return {
      question: q,
      answer: `Agent fleet health is green. This week's cadence: ${rhythmStrip
        .filter((d): d is RhythmDay & { deploys: number } => d.deploys !== null)
        .map((d) => `${d.day} ${d.deploys}`)
        .join(", ")}. Active rollout is ${active?.feature ?? "n/a"} at ${active?.deploys ?? 0} deploys, no retry spikes on the live surface.`,
      source: "source: ShipOps rhythm strip + agent telemetry",
      tone: "info",
    };
  }

  // Feature-specific landing question
  const feature = findFeature(q);
  if (feature) return landingVerdict(feature);

  // Fallback
  return {
    question: q,
    answer: `The framework reasons over agent-native signals (time-to-first-deploy, iterate-loop count, agent integration %, retry rate, downstream reuse) rather than human clicks. Try asking whether a specific feature landed - for example "Did feature-analytics-v2 land successfully?"`,
    source: "source: framework definition",
    tone: "info",
  };
}

export const suggestedQuestions = [
  "What's the retry rate?",
  "Show latest deploys",
  "Agent health report",
];

export const seedQuestion = "Did feature-analytics-v2 land successfully?";
