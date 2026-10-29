#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DEFAULT_SCORE_CONFIG, defaultConfigFile, loadConfig, scoreConfigSchema } from "./config.js";
import { examplePath } from "./example.js";
import { scanToMarkdown, scanToTerminal, scoreToMarkdown, scoreToTerminal, type Format } from "./report.js";
import { runScan } from "./scan/index.js";
import { scoreRows } from "./score/engine.js";
import { loadData } from "./score/ingest.js";

const VERSION = "0.1.0";
const DEFAULT_CONFIG = "agent-landing.config.json";

const HELP = `agent-landing ${VERSION}
Judge whether a product is ready for agent users, and whether a launch landed for them.

Usage
  agent-landing scan <url> [options]     Can an agent find and use this product?
  agent-landing score --data <file>      Did a launch land, from your own telemetry (.csv or .json)
  agent-landing score --example          Score the synthetic demo dataset
  agent-landing init [--force]           Write ${DEFAULT_CONFIG} with defaults

Options
  --config <path>     Config file (default: ./${DEFAULT_CONFIG} when present)
  --json              JSON output
  --md                Markdown report
  --out <path>        Write output to a file instead of stdout
  --pages <list>      scan: comma-separated key pages, overrides config (e.g. /,/docs,/pricing)
  --allow-private     scan: allow loopback and private network targets (local testing only)
  -h, --help          Show help
  -v, --version       Show version
`;

class UsageError extends Error {}

const fileExists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const resolveConfigPath = async (explicit: string | undefined): Promise<string | undefined> =>
  explicit ?? ((await fileExists(DEFAULT_CONFIG)) ? DEFAULT_CONFIG : undefined);

const formatOf = (v: { json?: boolean; md?: boolean }): Format => {
  if (v.json && v.md) throw new UsageError("Pick one of --json or --md");
  return v.json ? "json" : v.md ? "md" : "terminal";
};

const emit = async (text: string, out: string | undefined): Promise<void> => {
  if (out) {
    await writeFile(out, text.endsWith("\n") ? text : `${text}\n`, "utf8");
    process.stderr.write(`Wrote ${out}\n`);
  } else process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
};

const useColor = (out: string | undefined): boolean => !out && !!process.stdout.isTTY && !process.env.NO_COLOR;

type Values = {
  config?: string;
  json?: boolean;
  md?: boolean;
  out?: string;
  pages?: string;
  "allow-private"?: boolean;
  data?: string;
  example?: boolean;
  force?: boolean;
  help?: boolean;
  version?: boolean;
};

const scan = async (positionals: string[], v: Values): Promise<void> => {
  const url = positionals[0];
  if (!url) throw new UsageError("scan needs a URL, for example: agent-landing scan https://example.com");
  const format = formatOf(v);
  const config = await loadConfig(await resolveConfigPath(v.config));
  const pages = v.pages?.split(",").map((p) => p.trim()).filter(Boolean);
  if (pages?.some((p) => !p.startsWith("/"))) throw new UsageError("--pages entries must start with /");
  const scanCfg = pages?.length ? { ...config.scan, keyPages: pages } : config.scan;
  if (format === "terminal" && !v.out) process.stderr.write(`Scanning ${url} ...\n`);
  const report = await runScan(url, scanCfg, { allowPrivate: v["allow-private"] ?? false }).catch((e: Error) => {
    throw new Error(/private or reserved/.test(e.message) ? `${e.message}. Pass --allow-private to scan a local or private target.` : e.message);
  });
  const text =
    format === "json" ? JSON.stringify(report, null, 2) : format === "md" ? scanToMarkdown(report) : scanToTerminal(report, useColor(v.out));
  await emit(text, v.out);
};

const score = async (v: Values): Promise<void> => {
  if (!v.example && !v.data) throw new UsageError("score needs --data <file.csv|file.json> or --example");
  if (v.example && v.data) throw new UsageError("Pick one of --data or --example");
  const format = formatOf(v);
  const source = v.example ? examplePath() : v.data!;
  const scoreCfg = v.example ? scoreConfigSchema.parse(DEFAULT_SCORE_CONFIG) : (await loadConfig(await resolveConfigPath(v.config))).score;
  const report = scoreRows(await loadData(source), scoreCfg);
  const label = v.example ? "example (synthetic, derived from the demo site)" : source;
  const text =
    format === "json"
      ? JSON.stringify(report, null, 2)
      : format === "md"
        ? scoreToMarkdown(report, label)
        : scoreToTerminal(report, label, useColor(v.out));
  await emit(text, v.out);
};

const init = async (v: Values): Promise<void> => {
  const path = v.out ?? DEFAULT_CONFIG;
  if ((await fileExists(path)) && !v.force) throw new UsageError(`${path} already exists. Pass --force to overwrite it.`);
  await writeFile(path, `${JSON.stringify(defaultConfigFile(), null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${path}. Edit keyPages and the score signals to match your product, then run "agent-landing scan <url>".\n`);
};

export const main = async (argv: string[]): Promise<number> => {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string" },
        json: { type: "boolean" },
        md: { type: "boolean" },
        out: { type: "string" },
        pages: { type: "string" },
        "allow-private": { type: "boolean" },
        data: { type: "string" },
        example: { type: "boolean" },
        force: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
    const v = values as Values;
    const [command, ...rest] = positionals;
    if (v.version) return process.stdout.write(`${VERSION}\n`), 0;
    if (v.help || !command || command === "help") return process.stdout.write(HELP), 0;
    if (command === "scan") await scan(rest, v);
    else if (command === "score") await score(v);
    else if (command === "init") await init(v);
    else throw new UsageError(`Unknown command "${command}"`);
    return 0;
  } catch (e) {
    const usage = e instanceof UsageError || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS");
    process.stderr.write(`agent-landing: ${(e as Error).message}\n${usage ? 'Run "agent-landing --help" for usage.\n' : ""}`);
    return usage ? 2 : 1;
  }
};

const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
