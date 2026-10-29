@AGENTS.md

# agent-landing

The Agent-as-User Landing Framework as a CLI (`scan`, `score`, `init`), a Claude Code skill, and the original Next.js demo site (agent-landing-rosic.vercel.app). Owner: Andy Rosic. Repo: github.com/andyuninvited/agent-landing (public).

## Stack

- Demo site: Next.js 16 (App Router), Tailwind v4, lucide-react. Deployment: Vercel.
- CLI: `packages/cli`, TypeScript strict, Node >= 20, ESM, zod 4. Tests: vitest. No runtime deps beyond zod.
- pnpm workspace (`packages/*`). Root package is `agent-landing-site`; the CLI package is `agent-landing`.

## Commands

```
pnpm dev                                  # demo site
pnpm build                                # demo site build (must stay green)
pnpm lint                                 # site lint (ignores packages/)
pnpm test                                 # CLI tests
pnpm --filter agent-landing build         # CLI to packages/cli/dist
pnpm --filter agent-landing typecheck
pnpm --filter agent-landing lint
pnpm --filter agent-landing gen:schema    # after any change to src/config.ts
node packages/cli/dist/cli.js --help
```

## Structure

```
app/ components/ lib/           demo site; lib/data.ts is the synthetic dataset
packages/cli/src/config.ts      zod schema, defaults, check ids and weights
packages/cli/src/scan/          net.ts (SSRF guard, caps), robots.ts, html.ts, collect.ts, checks/
packages/cli/src/score/         ingest.ts (CSV/JSON), engine.ts (normalize, lens scores, verdicts, headlines)
packages/cli/schema/            generated JSON Schema (a test fails if stale)
packages/cli/examples/          launches.csv derived from lib/data.ts
skills/agent-landing/           SKILL.md + references/ (check catalog, scoring method)
```

## Architecture

`scan` collects a Snapshot (robots, llms.txt, sitemap, key pages, markdown variants, API and MCP probes) through one guarded fetcher with a request budget, then runs pure check functions over it. `score` ingests rows, aggregates per feature and signal, normalizes to 0-100 health, and computes weight-normalized lens scores with config-driven verdict ladders.

## Conventions

- Checks are pure `(snapshot, config) => { score, reason, fix, details }`; add new ones to `CHECKS` in `scan/index.ts`, `CHECK_IDS` in `config.ts`, and the check catalog.
- Nothing fetched is executed. Strings from fetched pages pass through `clip`/`safe` before output.
- No LLM calls and no paid APIs anywhere, including tests. Tests never hit the internet.
- The demo site does not import from the CLI package; `test/engine.test.ts` asserts parity with `lib/scoring.ts` instead.

## Key Context

- `--allow-private` exists only for local fixture scans; the default refuses private, loopback, and reserved IPs at DNS resolution time, including redirect hops.
- Not published to npm. The skill finds the CLI on PATH, in the project, or in a local clone.
- Root `pnpm lint` has a pre-existing `react-hooks/set-state-in-effect` error in `components/landing-lens.tsx` (tracked separately).
- History and decisions: DEVLOG.md. Usage and config reference: README.md.
