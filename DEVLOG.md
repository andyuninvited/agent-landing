# DEVLOG

## Working State

**Current Task**: Turn the demo into a generic CLI plus Claude Code skill (issues #1 and #2, branch `feat/1-2-cli-and-skill`).
**Key Files**:
- `packages/cli/src/scan/net.ts`: guarded HTTP fetcher. DNS-time private IP blocking, redirect hop checks, timeout, decompressed size cap.
- `packages/cli/src/scan/checks/`: the ten scan checks as pure functions over a Snapshot.
- `packages/cli/src/score/engine.ts`: config-driven scoring, verdicts, cross-lens headlines, alerts.
- `packages/cli/src/config.ts`: zod schema and defaults; source of the generated JSON Schema.
- `skills/agent-landing/SKILL.md`: interview, configure, run, explain.
**Active Decisions**:
- Demo site left untouched. A parity test proves the CLI reproduces `lib/scoring.ts` on the example data, which is lower risk than rewiring the site's imports.
- Hand-rolled CSV, robots.txt, and HTML extraction to keep zod as the only runtime dependency. HTML is read with regexes as text and never parsed into a DOM or executed.
- The fetcher uses `node:http` with a custom `lookup` so the private-address check runs on the resolved address at connect time (blocks DNS rebinding), not on a pre-resolved name.
- A scan whose robots.txt and key pages all fail at the network level throws instead of reporting zeros, so an unreachable or blocked target never reads as a bad score.
- No LLM explanation mode. The skill gives Claude the JSON to explain.
- Root package renamed to `agent-landing-site` so the CLI can own the `agent-landing` name in the workspace.
**Next Steps**: Andy reviews the PR. Decide on a license and npm publishing. Fix the pre-existing site lint error in its own ticket.
**Blockers**: None.
**Gotchas**:
- `pnpm --filter agent-landing gen:schema` after any change to `config.ts`, or the schema sync test fails.
- The CLI tsconfig cannot use `noUncheckedIndexedAccess` because the parity test type-checks `lib/data.ts`.

## Session Archive

### 2026-10-29 - CLI and skill
Opened issues #1 (scan) and #2 (score, init, config, skill). Built `packages/cli` with `scan`, `score`, and `init`, ten scan checks, a zod config with a generated JSON Schema, CSV and JSON ingest in wide and long formats, and the `skills/agent-landing` skill with references. 112 vitest tests, including a local fixture server for scan integration and SSRF, size cap, timeout, and redirect tests. Site build still green under Turbopack. One live scan of agent-landing-rosic.vercel.app scored 40/100 (no llms.txt, markdown, API spec, or MCP; SSR and auth friction clean).

## Milestones

- 2026-06-26 - Demo site live at agent-landing-rosic.vercel.app.
- 2026-10-29 - CLI and skill PR opened.

## Mistakes & Lessons

- 2026-10-29 - First fixture scan without `--allow-private` scored every check 0 because every fetch was refused. Root cause: network errors were treated as "file missing". Fix: an all-unreachable scan now throws with a hint to pass `--allow-private`, and content checks skip pages that failed to load. Lesson: separate "absent" from "unknown" in any scorer.

## Technical Debt

- `components/landing-lens.tsx` fails root lint (`react-hooks/set-state-in-effect`); pre-existing, left alone to keep the site untouched.
- The demo site still carries its own `lib/scoring.ts`; it could import the CLI engine later.
- MCP discovery probes follow draft proposals and will need updating as a standard settles.
