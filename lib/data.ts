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
