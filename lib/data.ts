// Synthetic, illustrative dataset for the Agent-as-User Landing Framework.
// No real Vercel data. Numbers are directional and clearly labeled illustrative
// throughout the UI. The point is the framework, not fake precision.

export type DeployPoint = {
  period: string; // e.g. "Jan", "W1"
  human: number;
  agent: number;
};

// Human vs agent deploys over ~6 months, agent share ramping toward ~30%.
export const deployMixMonthly: DeployPoint[] = [
  { period: "Jan", human: 9200, agent: 240 },
  { period: "Feb", human: 9600, agent: 680 },
  { period: "Mar", human: 9900, agent: 1480 },
  { period: "Apr", human: 10200, agent: 2360 },
  { period: "May", human: 10450, agent: 3380 },
  { period: "Jun", human: 10600, agent: 4520 },
];

export const deployMixWeekly: DeployPoint[] = [
  { period: "W1", human: 2520, agent: 880 },
  { period: "W2", human: 2540, agent: 980 },
  { period: "W3", human: 2560, agent: 1120 },
  { period: "W4", human: 2600, agent: 1290 },
];

const latest = deployMixMonthly[deployMixMonthly.length - 1];
export const agentSharePct = Math.round(
  (latest.agent / (latest.agent + latest.human)) * 100,
);

export const headlineStats = {
  agentDeploySharePct: agentSharePct, // ~30%
  agentShareDeltaPct: 12,
  growthRateLabel: "+1k%",
  growthWindow: "Last 6 mo.",
  dominantAgentPct: 75,
  dominantAgent: "Claude Code",
  executionsPeakPct: 24.1,
};

// Agent-native landing metrics that replace human-adoption metrics.
export type AgentMetric = {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: "good" | "neutral";
  accent: "green" | "blue";
  spark: number[]; // 0..1 normalized sparkline points
};

export const agentMetrics: AgentMetric[] = [
  {
    key: "ttfd",
    label: "Time-to-first-deploy",
    value: "14.2s",
    delta: "-2.1s",
    deltaTone: "good",
    accent: "green",
    spark: [0.85, 0.7, 0.72, 0.5, 0.45, 0.3, 0.12],
  },
  {
    key: "loop",
    label: "Iterate loop count",
    value: "8.4x",
    delta: "Avg",
    deltaTone: "neutral",
    accent: "blue",
    spark: [0.5, 0.55, 0.52, 0.6, 0.5, 0.48, 0.5],
  },
];

// Legacy metrics that go blind for an agent deploy.
export const legacyMetrics = [
  "Human clicks & navigation",
  "Daily active users (DAU)",
  "In-product tooltip engagement",
];

// Agent-native replacements (full list for the framework panel reasoning).
export const agentNativeMetrics = [
  "Time-to-first-working-deploy",
  "Deploy -> iterate loop count",
  "Agent retry / success rate",
  "Downstream reuse of the shipped surface",
  "Composite acceptance (final result vs mandate, human verdict)",
];

// Features the "Ask the framework" panel can reason over.
export type FeatureRecord = {
  id: string;
  name: string;
  deployedAt: string; // UTC time label
  humanAdoption: "flat" | "moderate" | "strong";
  agentIntegrationPct: number; // % of active agent sessions that used it
  windowMins: number;
  retrySpike: boolean;
  retryRatePct: number;
  downstreamReuse: "none" | "growing" | "strong";
  verdict: "landed" | "landed-agent-only" | "at-risk";
};

export const features: FeatureRecord[] = [
  {
    id: "feature-analytics-v2",
    name: "feature-analytics-v2",
    deployedAt: "14:02 UTC",
    humanAdoption: "flat",
    agentIntegrationPct: 42,
    windowMins: 60,
    retrySpike: false,
    retryRatePct: 3.1,
    downstreamReuse: "growing",
    verdict: "landed-agent-only",
  },
  {
    id: "sdk-v4",
    name: "sdk-v4",
    deployedAt: "09:18 UTC",
    humanAdoption: "moderate",
    agentIntegrationPct: 61,
    windowMins: 90,
    retrySpike: false,
    retryRatePct: 2.4,
    downstreamReuse: "strong",
    verdict: "landed",
  },
  {
    id: "auth-refactor",
    name: "auth-refactor",
    deployedAt: "Mon 11:40 UTC",
    humanAdoption: "strong",
    agentIntegrationPct: 28,
    windowMins: 120,
    retrySpike: true,
    retryRatePct: 11.7,
    downstreamReuse: "none",
    verdict: "at-risk",
  },
];

// ShipOps rhythm strip - weekly launch cadence.
export type RhythmDay = {
  day: string;
  deploys: number | null;
  feature: string | null;
  state: "done" | "active" | "upcoming";
};

export const rhythmStrip: RhythmDay[] = [
  { day: "Monday", deploys: 342, feature: "Auth Refactor", state: "done" },
  { day: "Tuesday", deploys: 410, feature: "Edge Cache Tune", state: "done" },
  { day: "Today (Wed)", deploys: 892, feature: "SDK v4 Rollout", state: "active" },
  { day: "Thursday", deploys: null, feature: null, state: "upcoming" },
  { day: "Friday", deploys: null, feature: "Weekly Review", state: "upcoming" },
];

// Landing scorecard - per feature, the signals each lens can see (0-100 health)
// with default weights. The point: under the human lens an agent-driven launch
// reads near-zero no matter how you weight it, because the adopter isn't human.
export type LensSignal = { key: string; label: string; value: number; weight: number };
export type LensView = { signals: LensSignal[]; takeaway: string };
export type FeatureScoring = { id: string; name: string; human: LensView; agent: LensView };

export const featureScoring: FeatureScoring[] = [
  {
    id: "feature-analytics-v2",
    name: "feature-analytics-v2",
    human: {
      takeaway:
        "Looks dead. Nobody clicked “adopt” and DAU didn’t move - because the adopters weren’t human.",
      signals: [
        { key: "clicks", label: "Human clicks & navigation", value: 8, weight: 25 },
        { key: "dau", label: "Daily active users (change)", value: 6, weight: 25 },
        { key: "tooltip", label: "In-product tooltip engagement", value: 11, weight: 25 },
        { key: "adopt", label: "Manual “adopt” clicks", value: 4, weight: 25 },
      ],
    },
    agent: {
      takeaway:
        "Landed. Agents integrated it in 42% of sessions within an hour, reuse is growing, no retry spike. Owner verdict: keep.",
      signals: [
        { key: "integration", label: "Agent integration rate", value: 84, weight: 20 },
        { key: "ttfd", label: "Time-to-first-working-deploy", value: 88, weight: 20 },
        { key: "loop", label: "Deploy → iterate loop health", value: 80, weight: 20 },
        { key: "retry", label: "Agent retry / success rate", value: 92, weight: 20 },
        { key: "reuse", label: "Downstream reuse", value: 60, weight: 20 },
        { key: "acceptance", label: "Composite acceptance (human verdict)", value: 85, weight: 30 },
      ],
    },
  },
  {
    id: "sdk-v4",
    name: "sdk-v4",
    human: {
      takeaway:
        "Partial. Humans adopted it moderately, but the old lens misses how much agents drove it.",
      signals: [
        { key: "clicks", label: "Human clicks & navigation", value: 55, weight: 25 },
        { key: "dau", label: "Daily active users (change)", value: 48, weight: 25 },
        { key: "tooltip", label: "In-product tooltip engagement", value: 50, weight: 25 },
        { key: "adopt", label: "Manual “adopt” clicks", value: 52, weight: 25 },
      ],
    },
    agent: {
      takeaway:
        "Landed strong, with deep downstream agent reuse across the SDK surface. Owner verdict: keep.",
      signals: [
        { key: "integration", label: "Agent integration rate", value: 90, weight: 20 },
        { key: "ttfd", label: "Time-to-first-working-deploy", value: 82, weight: 20 },
        { key: "loop", label: "Deploy → iterate loop health", value: 78, weight: 20 },
        { key: "retry", label: "Agent retry / success rate", value: 94, weight: 20 },
        { key: "reuse", label: "Downstream reuse", value: 95, weight: 20 },
        { key: "acceptance", label: "Composite acceptance (human verdict)", value: 90, weight: 30 },
      ],
    },
  },
  {
    id: "auth-refactor",
    name: "auth-refactor",
    human: {
      takeaway:
        "Looks like a clean win - humans adopted it. The old lens would ship it and miss the agent-side failure.",
      signals: [
        { key: "clicks", label: "Human clicks & navigation", value: 80, weight: 25 },
        { key: "dau", label: "Daily active users (change)", value: 75, weight: 25 },
        { key: "tooltip", label: "In-product tooltip engagement", value: 70, weight: 25 },
        { key: "adopt", label: "Manual “adopt” clicks", value: 78, weight: 25 },
      ],
    },
    agent: {
      takeaway:
        "At risk. Retry rate spiked to 11.7% and downstream reuse stalled - agents are failing on it. Owner verdict: returned. Every step shipped cleanly; the composite missed the mandate.",
      signals: [
        { key: "integration", label: "Agent integration rate", value: 40, weight: 20 },
        { key: "ttfd", label: "Time-to-first-working-deploy", value: 70, weight: 20 },
        { key: "loop", label: "Deploy → iterate loop health", value: 45, weight: 20 },
        { key: "retry", label: "Agent retry / success rate", value: 30, weight: 20 },
        { key: "reuse", label: "Downstream reuse", value: 15, weight: 20 },
        { key: "acceptance", label: "Composite acceptance (human verdict)", value: 20, weight: 30 },
      ],
    },
  },
];
