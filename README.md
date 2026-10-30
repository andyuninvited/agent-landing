# agent-landing

[![npm](https://img.shields.io/npm/v/agent-landing)](https://www.npmjs.com/package/agent-landing) [![downloads](https://img.shields.io/npm/dm/agent-landing)](https://www.npmjs.com/package/agent-landing) [![GitHub stars](https://img.shields.io/github/stars/andyuninvited/agent-landing?style=social)](https://github.com/andyuninvited/agent-landing)

**Can an AI agent actually use your product? And did your last launch land with the agents, or only with the people?**

Agents now read your docs, call your API, and ship code against it, often before anyone on the team opens your landing page. Most product sites are still built for human eyes. They have pages that render only in JavaScript, no llms.txt, no markdown versions of the docs, and an API spec an agent can't find. Most launch dashboards still count human clicks too, so they can't tell when agents adopted a feature or kept retrying it until they gave up.

agent-landing checks both. `scan` shows you what an agent sees when it arrives and ranks the fixes by points. `score` reads your own launch data and gives a verdict for each audience you care about.

## I scanned my own sites first

I built the framework behind this tool, then pointed `scan` at my own demo site. It scored **40 out of 100**. The pages were readable without JavaScript and an agent could get in without a login wall, but there was no llms.txt, no markdown, no sitemap, and no API spec. The top three fixes on the list were worth up to 35 more points.

My personal site, andyrosic.com, scored **53, an F**. So I worked the fix list: explicit AI agent rules in robots.txt, an llms.txt, markdown versions of the pages, a read-only API with an OpenAPI spec, and a read-only MCP server. The rescan scored **100**. Every one of those fixes came straight off the report, and the [before and after](https://hypocrisy-highlighter.vercel.app/c/andy-rosic) is public.

`score` catches the opposite problem. In the bundled example, an auth refactor scores 76 under the human lens, which looks like a win. Under the agent lens it scores 35, and the tool flags why:

```text
auth-refactor
  Not yet. It looks landed under the Human-adoption lens, but it is at risk under the Agent-as-user lens.
  Human-adoption lens   76/100  Landed
  Agent-as-user lens    35/100  At risk
  alert Retry rate spiked to 11.7%. A human-adoption dashboard would have called this a win and missed the failure.
```

## The AI Hypocrisy Highlighter

Then I ran `scan` on the homepages of 52 companies that sell AI agents. The class average is 61, a D, and 22 of them got an F. Four turned the scanner away at the front door with a 403. Every company has a report card with a letter grade, a teacher's comment, and its cheapest fixes at [hypocrisy-highlighter.vercel.app](https://hypocrisy-highlighter.vercel.app).

## Why use it

- **You define what landed means.** Signals, weights, thresholds, lenses, and verdict labels live in one config file. Add a partner lens, drop the API checks for a marketing site, or weight retry rate twice as heavily as clicks.
- **Every fix has a number on it.** The scan ranks its fixes by how many points each one is worth, so the first item on the list is the one to do first.
- **Claude sets it up for you.** The Claude Code skill asks who your agent users are and what data you have, then writes the config and walks you through the results.
- **It runs locally and costs nothing.** No LLM calls and no paid APIs. The scanner respects robots.txt, caps page sizes, and won't fetch private network addresses unless you ask it to.

## What it checks

It answers two questions for any product:

1. **Can an agent find and use this product?** `agent-landing scan <url>` checks the surfaces agents actually read (robots.txt, llms.txt, sitemaps, server-rendered HTML, markdown, JSON-LD, API specs, MCP discovery, auth friction, and token cost) and returns a score per check, an overall score, and a prioritized fix list.
2. **Did a launch land for agent users?** `agent-landing score --data <events>` scores each feature from your own telemetry under the lenses you define (human, agent, partner, or any other), with verdicts and a plain-language explanation such as a retry spike callout.

Signals, weights, thresholds, lenses, verdict labels, and scan settings all live in one validated config file. The CLI makes no LLM calls and uses no paid APIs.

The repo also holds the original demo site, live at [agent-landing-rosic.vercel.app](https://agent-landing-rosic.vercel.app), which shows the framework on synthetic Vercel data.

## Quickstart: CLI

Run it with npx, no install needed:

```bash
npx agent-landing scan https://your-product.com
```

Or install it globally with `npm install -g agent-landing`. Then, in your own project:

```bash
agent-landing init                               # writes agent-landing.config.json
agent-landing scan https://your-product.com      # terminal report
agent-landing scan https://your-product.com --md --out scan.md
agent-landing score --data launches.csv --json
agent-landing score --example                    # synthetic demo data
```

| Option | Applies to | What it does |
| --- | --- | --- |
| `--config <path>` | scan, score | Config file. Defaults to `./agent-landing.config.json` when present, else built-in defaults. |
| `--json`, `--md` | scan, score | JSON or Markdown output instead of the terminal report. |
| `--out <path>` | all | Write output to a file. For `init`, the config path. |
| `--pages /,/docs` | scan | Override the key pages for one run. |
| `--allow-private` | scan | Allow loopback and private network targets. For scanning your own local dev server only. |
| `--force` | init | Overwrite an existing config. |

Exit codes: 0 on success, 1 on a runtime or config error, 2 on a usage error.

## Quickstart: Claude Code skill

Install the plugin from inside Claude Code:

```
/plugin install agent-landing --marketplace andyuninvited/agent-landing
```

On Claude Code older than 2.1.275, run `/plugin marketplace add andyuninvited/agent-landing` first, then `/plugin install agent-landing@agent-landing`. You can also copy `skills/agent-landing/` into a project's `.claude/skills/` (or your personal `~/.claude/skills/`).

Then ask Claude something like "can agents use our docs site?" or "did the v2 launch land for agent users?". Claude interviews you about the product, the agent users, the pages that matter, the telemetry you have, and what "landed" means for you. It then writes the config, runs `scan` and `score`, and walks you through the top fixes. The skill looks for the CLI on your PATH, then in the project, then in a local clone.

## Example output

`agent-landing scan https://agent-landing-rosic.vercel.app` (the demo site itself, scanned 2026-10-29):

```
Overall 40/100  (10 checks scored, 15 requests, pages: /)

  WARN  70  robots.txt rules for AI agents
            No robots.txt (HTTP 404). Agents are allowed by default, but there is no explicit AI agent policy and no Sitemap line.
  FAIL   0  llms.txt and llms-full.txt
            No /llms.txt (HTTP 404).
  PASS 100  Server-rendered readable HTML
            All 1 key page(s) return readable HTML without running JavaScript.
  ...

Prioritized fixes
  1. llms.txt and llms-full.txt (score 0, up to +15 overall)
  2. Markdown versions of key pages (score 0, up to +10 overall)
  3. OpenAPI and API docs discoverability (score 0, up to +10 overall)
```

`agent-landing score --example`:

```
feature-analytics-v2
  Yes and no. It landed under the Agent-as-user lens, and the Human-adoption lens can't see it.
  Human-adoption lens    7/100  Can't see it
  Agent-as-user lens    82/100  Landed

auth-refactor
  Not yet. It looks landed under the Human-adoption lens, but it is at risk under the Agent-as-user lens.
  Human-adoption lens   76/100  Landed
  Agent-as-user lens    35/100  At risk
  alert Retry rate spiked to 11.7%. A human-adoption dashboard would have called this a win and missed the failure.
```

## Scan checks

| Check | Default weight | What it looks for |
| --- | --- | --- |
| `robots-ai` | 15 | robots.txt rules for ClaudeBot, Claude-User, GPTBot, ChatGPT-User, PerplexityBot, and other agents on each key page, plus an explicit policy and a Sitemap line |
| `llms-txt` | 15 | `/llms.txt` with a title, summary, and links, plus `/llms-full.txt` |
| `sitemap` | 5 | A valid XML sitemap, referenced from robots.txt, listing the key pages |
| `ssr-readable` | 15 | Key pages readable without JavaScript, with a title, meta description, and h1 |
| `markdown` | 10 | Markdown versions via `Accept: text/markdown` or `.md` URLs, advertised with `<link rel="alternate">` |
| `structured-data` | 5 | Valid schema.org JSON-LD on key pages |
| `api-docs` | 10 | An OpenAPI spec, `/.well-known/api-catalog`, or linked API docs |
| `mcp` | 10 | A `/.well-known` MCP document or a documented MCP endpoint |
| `auth-friction` | 10 | Login redirects, 401/403/429, bot challenges, CAPTCHAs, and password walls on key pages |
| `page-weight` | 5 | Token cost of key pages, using the markdown version when one exists |

Full scoring rules for each check: [skills/agent-landing/references/check-catalog.md](skills/agent-landing/references/check-catalog.md).

### Fetching and safety

The scanner reads robots.txt first and obeys it for its own requests (token `agent-landing`). It sends a clear User-Agent and enforces a per-request timeout, a response size cap after decompression, a page cap, and a request cap. Every connection, including each redirect hop, is checked at DNS resolution time and refused for loopback, private, link-local, CGNAT, multicast, and reserved addresses in IPv4 and IPv6. Fetched content is parsed as text and JSON and never executed, and strings lifted from fetched pages are stripped of control characters before they reach your terminal.

## Config reference

`agent-landing init` writes `agent-landing.config.json` with a `$schema` link for editor autocomplete. The schema lives at [packages/cli/schema/agent-landing.schema.json](packages/cli/schema/agent-landing.schema.json) and is generated from the zod schema that validates the file at load time.

### `scan`

| Field | Default | Meaning |
| --- | --- | --- |
| `keyPages` | `["/"]` | Paths that matter most to an agent. Each starts with `/`. |
| `maxPages` | 5 | Upper bound on key pages fetched (1 to 20). |
| `maxRequests` | 40 | Upper bound on requests per scan. |
| `timeoutMs` | 10000 | Per-request timeout. |
| `maxBytes` | 2000000 | Per-response cap after decompression. |
| `userAgent` | `agent-landing/0.1 (+repo URL)` | User-Agent sent with every request. |
| `agentUserAgents` | ClaudeBot, Claude-User, GPTBot, and 8 more | Agent tokens tested against robots.txt. |
| `checks.<id>.enabled` | `true` | Turn a check off (for example `api-docs` for a product without an API). |
| `checks.<id>.weight` | see table above | Weight in the overall score. |

### `score`

| Field | Default | Meaning |
| --- | --- | --- |
| `format` | `wide` | `wide`: one row per feature, a column per signal. `long`: one row per feature, signal, and value. |
| `columns` | `feature`, `signal`, `value` | Column names in your data. |
| `signalColumns` | `{}` | Wide format: signal key to column name when they differ. |
| `aggregate` | `mean` | How repeated values combine: `mean`, `sum`, `min`, `max`, or `last`. |
| `lenses` | human, agent | Each lens has an `id`, a `label`, and an optional `verdicts` ladder. |
| `verdicts` | Landed 70, Mixed signal 45, At risk 0 | Shared ladder of `{ min, label, tone }`. Tones: `landed`, `mixed`, `risk`, `blind`. |
| `signals` | the demo's 10 signals plus a watch-only retry rate | Each has a `key`, `label`, `lens`, `weight`, `normalize` rule, and optional `alert`. |

`normalize` is `{ "type": "identity" }` for values already on 0 to 100, `{ "type": "linear", "min": 0, "max": 20, "direction": "lower" }` for raw values, or `{ "type": "boolean", "good": true }`. Weight 0 makes a signal watch-only. An `alert` is `{ "when": "above", "value": 8, "message": "Retry rate spiked to {value}%." }`, compared against the raw value.

A custom lens looks like this:

```json
{
  "id": "partner",
  "label": "Partner lens",
  "verdicts": [
    { "min": 60, "label": "Shipped", "tone": "landed" },
    { "min": 0, "label": "Stalled", "tone": "risk" }
  ]
}
```

The full scoring method, including ingest rules and how headlines are chosen across lenses, is in [skills/agent-landing/references/scoring-method.md](skills/agent-landing/references/scoring-method.md).

## Data schema

CSV or JSON. JSON is an array of objects or `{ "events": [...] }`. Numbers may carry a trailing `%`, and `true`/`false` count as 1 and 0.

Wide, the default (see [packages/cli/examples/launches.csv](packages/cli/examples/launches.csv)):

```csv
feature,agent_integration,agent_ttfd,agent_retry,retry_rate_pct
sdk-v4,90,82,94,2.4
```

Long, with `"format": "long"`:

```json
[
  { "feature": "sdk-v4", "signal": "agent_integration", "value": 90 },
  { "feature": "sdk-v4", "signal": "retry_rate_pct", "value": 2.4 }
]
```

## The demo site

The Next.js app at the repo root is the original prototype of the framework, built for a Vercel Product Strategy and Operations conversation. Its argument is that a fast-growing share of Vercel deploys now comes from agents (around 30%, most of them Claude Code), and a landing framework built to measure human adoption cannot see that user. All of its data is illustrative and synthetic, and the numbers are directional.

- **Who's actually deploying**: human vs agent deploy mix trending toward about 30% agent.
- **Landing, rebuilt**: the metrics a human-adoption dashboard goes blind on, and the agent-native replacements.
- **Did it land? It depends on the lens**: the interactive Landing Scorecard that `agent-landing score` generalizes.
- **Ask the framework**: a deterministic local panel that answers questions like "Did feature-analytics-v2 land?" with no live model behind it.
- **ShipOps rhythm strip**: the weekly launch cadence.

Stack: Next.js 16 (App Router), Tailwind v4, and lucide-react, deployed on Vercel.

## Develop

```bash
pnpm install
pnpm dev                              # demo site
pnpm build                            # demo site production build
pnpm test                             # CLI tests (vitest)
pnpm --filter agent-landing build     # CLI build to packages/cli/dist
pnpm --filter agent-landing typecheck
pnpm --filter agent-landing lint
pnpm --filter agent-landing gen:schema   # regenerate the JSON Schema after changing src/config.ts
```

```
app/, components/, lib/        Demo site (Next.js)
packages/cli/
  src/cli.ts                   Command parsing and output
  src/config.ts                zod config schema and defaults
  src/scan/                    Fetcher (SSRF guard, caps), robots.txt, HTML extraction, checks
  src/score/                   CSV/JSON ingest and the scoring engine
  schema/                      Generated JSON Schema
  examples/launches.csv        Synthetic data derived from lib/data.ts
  test/                        vitest suites, including a local fixture server
skills/agent-landing/          Claude Code skill and references
```

Tests never touch the internet. Scan tests run against a local HTTP server.


## License

MIT. Copyright (c) 2026 Andy Rosic.
