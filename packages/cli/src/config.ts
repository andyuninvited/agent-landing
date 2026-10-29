import { readFile } from "node:fs/promises";
import { z } from "zod";

export const SCHEMA_URL =
  "https://raw.githubusercontent.com/andyuninvited/agent-landing/main/packages/cli/schema/agent-landing.schema.json";

export const CHECK_IDS = [
  "robots-ai",
  "llms-txt",
  "sitemap",
  "ssr-readable",
  "markdown",
  "structured-data",
  "api-docs",
  "mcp",
  "auth-friction",
  "page-weight",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

const DEFAULT_CHECK_WEIGHTS: Record<CheckId, number> = {
  "robots-ai": 15,
  "llms-txt": 15,
  sitemap: 5,
  "ssr-readable": 15,
  markdown: 10,
  "structured-data": 5,
  "api-docs": 10,
  mcp: 10,
  "auth-friction": 10,
  "page-weight": 5,
};

export const DEFAULT_AGENT_USER_AGENTS = [
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
];

const checkSetting = z
  .object({
    enabled: z.boolean().default(true).describe("Run this check."),
    weight: z.number().min(0).max(100).optional().describe("Weight in the overall score. Defaults per check."),
  })
  .strict();

const checksSchema = z
  .object(
    Object.fromEntries(CHECK_IDS.map((id) => [id, checkSetting.optional()])) as Record<
      CheckId,
      z.ZodOptional<typeof checkSetting>
    >,
  )
  .strict()
  .default({});

const pagePath = z
  .string()
  .regex(/^\//, "Key pages are paths on the scanned site and must start with /");

export const scanConfigSchema = z
  .object({
    keyPages: z.array(pagePath).min(1).default(["/"]).describe("Paths that matter most to an agent, such as /, /docs, /pricing."),
    maxPages: z.number().int().min(1).max(20).default(5).describe("Upper bound on key pages fetched."),
    maxRequests: z.number().int().min(5).max(100).default(40).describe("Upper bound on total HTTP requests per scan."),
    timeoutMs: z.number().int().min(1000).max(60000).default(10000).describe("Per-request timeout."),
    maxBytes: z.number().int().min(10_000).max(10_000_000).default(2_000_000).describe("Per-response size cap after decompression."),
    userAgent: z.string().min(1).default("agent-landing/0.1 (+https://github.com/andyuninvited/agent-landing)"),
    agentUserAgents: z.array(z.string().min(1)).min(1).default(DEFAULT_AGENT_USER_AGENTS).describe("AI agent and crawler tokens checked against robots.txt."),
    checks: checksSchema,
  })
  .strict();

const toneSchema = z.enum(["landed", "mixed", "risk", "blind"]);

const verdictStep = z
  .object({
    min: z.number().min(0).max(100).describe("Lowest lens score that earns this verdict."),
    label: z.string().min(1),
    tone: toneSchema,
  })
  .strict();

const verdictLadder = z
  .array(verdictStep)
  .min(1)
  .refine((steps) => steps.some((s) => s.min === 0), "A verdict ladder needs a step with min 0");

const normalizeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("identity") }).strict().describe("Value is already a 0-100 health score."),
  z
    .object({
      type: z.literal("linear"),
      min: z.number(),
      max: z.number(),
      direction: z.enum(["higher", "lower"]).default("higher").describe("Whether higher raw values are healthier."),
    })
    .strict()
    .refine((n) => n.max !== n.min, "linear normalize needs max different from min"),
  z
    .object({
      type: z.literal("boolean"),
      good: z.boolean().default(true).describe("Which value counts as healthy."),
    })
    .strict(),
]);

const alertSchema = z
  .object({
    when: z.enum(["above", "below"]),
    value: z.number().describe("Raw threshold, compared before normalization."),
    message: z.string().optional().describe("Template with {label}, {value}, and {threshold} placeholders."),
  })
  .strict();

const signalSchema = z
  .object({
    key: z.string().regex(/^[A-Za-z0-9_.-]+$/),
    label: z.string().min(1),
    lens: z.string().min(1),
    weight: z.number().min(0).describe("0 makes the signal watch-only: shown and alerted on, never scored."),
    normalize: normalizeSchema.default({ type: "identity" }),
    alert: alertSchema.optional(),
  })
  .strict();

const lensSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/),
    label: z.string().min(1),
    verdicts: verdictLadder.optional().describe("Overrides the shared verdict ladder for this lens."),
  })
  .strict();

export const DEFAULT_VERDICTS: z.input<typeof verdictLadder> = [
  { min: 70, label: "Landed", tone: "landed" },
  { min: 45, label: "Mixed signal", tone: "mixed" },
  { min: 0, label: "At risk", tone: "risk" },
];

// Mirrors lib/scoring.ts: under the human lens a near-zero score is invisible, not at risk.
export const HUMAN_VERDICTS: z.input<typeof verdictLadder> = [
  { min: 70, label: "Landed", tone: "landed" },
  { min: 45, label: "Mixed signal", tone: "mixed" },
  { min: 30, label: "At risk", tone: "risk" },
  { min: 0, label: "Can't see it", tone: "blind" },
];

export const scoreConfigSchema = z
  .object({
    format: z.enum(["wide", "long"]).default("wide").describe("wide: one row per feature with a column per signal. long: one row per feature, signal, and value."),
    columns: z
      .object({
        feature: z.string().default("feature"),
        signal: z.string().default("signal"),
        value: z.string().default("value"),
      })
      .strict()
      .default({ feature: "feature", signal: "signal", value: "value" })
      .describe("Column names in your data. signal and value apply to the long format."),
    signalColumns: z.record(z.string(), z.string()).default({}).describe("Wide format: signal key to column name, when they differ."),
    aggregate: z.enum(["mean", "sum", "min", "max", "last"]).default("mean").describe("How repeated rows for one feature and signal combine."),
    lenses: z.array(lensSchema).min(1),
    verdicts: verdictLadder.default(DEFAULT_VERDICTS),
    signals: z.array(signalSchema).min(1),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    const lensIds = new Set(cfg.lenses.map((l) => l.id));
    if (lensIds.size !== cfg.lenses.length) ctx.addIssue({ code: "custom", message: "Lens ids must be unique", path: ["lenses"] });
    const keys = cfg.signals.map((s) => s.key);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "Signal keys must be unique", path: ["signals"] });
    cfg.signals.forEach((s, i) => {
      if (!lensIds.has(s.lens)) ctx.addIssue({ code: "custom", message: `Signal "${s.key}" names unknown lens "${s.lens}"`, path: ["signals", i, "lens"] });
    });
  });

export const DEFAULT_SCORE_CONFIG: z.input<typeof scoreConfigSchema> = {
  format: "wide",
  lenses: [
    { id: "human", label: "Human-adoption lens", verdicts: HUMAN_VERDICTS },
    { id: "agent", label: "Agent-as-user lens" },
  ],
  signals: [
    { key: "human_clicks", label: "Human clicks & navigation", lens: "human", weight: 25 },
    { key: "human_dau_change", label: "Daily active users (change)", lens: "human", weight: 25 },
    { key: "human_tooltip", label: "In-product tooltip engagement", lens: "human", weight: 25 },
    { key: "human_adopt_clicks", label: "Manual adopt clicks", lens: "human", weight: 25 },
    { key: "agent_integration", label: "Agent integration rate", lens: "agent", weight: 20 },
    { key: "agent_ttfd", label: "Time-to-first-working-deploy", lens: "agent", weight: 20 },
    { key: "agent_loop", label: "Deploy to iterate loop health", lens: "agent", weight: 20 },
    { key: "agent_retry", label: "Agent retry / success rate", lens: "agent", weight: 20 },
    { key: "agent_reuse", label: "Downstream reuse", lens: "agent", weight: 20 },
    { key: "agent_acceptance", label: "Composite acceptance (human verdict)", lens: "agent", weight: 30 },
    {
      key: "retry_rate_pct",
      label: "Agent retry rate",
      lens: "agent",
      weight: 0,
      normalize: { type: "linear", min: 0, max: 20, direction: "lower" },
      alert: {
        when: "above",
        value: 8,
        message: "Retry rate spiked to {value}%. A human-adoption dashboard would have called this a win and missed the failure.",
      },
    },
  ],
};

export const configSchema = z
  .object({
    $schema: z.string().optional(),
    scan: scanConfigSchema.default(() => scanConfigSchema.parse({})),
    score: scoreConfigSchema.default(() => scoreConfigSchema.parse(DEFAULT_SCORE_CONFIG)),
  })
  .strict();

export type Config = z.output<typeof configSchema>;
export type ScanConfig = z.output<typeof scanConfigSchema>;
export type ScoreConfig = z.output<typeof scoreConfigSchema>;
export type Signal = ScoreConfig["signals"][number];
export type Lens = ScoreConfig["lenses"][number];
export type VerdictStep = z.output<typeof verdictStep>;
export type VerdictTone = z.output<typeof toneSchema>;

export const checkWeight = (cfg: ScanConfig, id: CheckId): number =>
  cfg.checks[id]?.weight ?? DEFAULT_CHECK_WEIGHTS[id];

export const checkEnabled = (cfg: ScanConfig, id: CheckId): boolean => cfg.checks[id]?.enabled ?? true;

export const formatIssues = (error: z.ZodError): string =>
  error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");

export const parseConfig = (raw: unknown): Config => {
  const result = configSchema.safeParse(raw);
  if (!result.success) throw new Error(`Invalid agent-landing config:\n${formatIssues(result.error)}`);
  return result.data;
};

export const loadConfig = async (path: string | undefined): Promise<Config> => {
  if (!path) return parseConfig({});
  const text = await readFile(path, "utf8").catch((e: NodeJS.ErrnoException) => {
    throw new Error(e.code === "ENOENT" ? `Config not found: ${path}. Run "agent-landing init" to create one.` : e.message);
  });
  const json: unknown = (() => {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Config ${path} is not valid JSON: ${(e as Error).message}`);
    }
  })();
  return parseConfig(json);
};

export const defaultConfigFile = (): Record<string, unknown> => ({
  $schema: SCHEMA_URL,
  scan: {
    keyPages: ["/", "/docs", "/pricing"],
    maxPages: 5,
    checks: Object.fromEntries(CHECK_IDS.map((id) => [id, { enabled: true, weight: DEFAULT_CHECK_WEIGHTS[id] }])),
  },
  score: DEFAULT_SCORE_CONFIG,
});
