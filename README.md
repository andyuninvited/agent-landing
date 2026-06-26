# The Agent-as-User Landing Framework

A working prototype of product-landing / adoption measurement, rebuilt for the
agent era. The thesis: Vercel's fastest-growing user is no longer a human with a
terminal, it is an agent (~30% of deploys, most of them Claude Code). A
product-landing framework built to measure human adoption cannot see that user.
This is what measuring the agent-as-user looks like.

Built on Vercel, with Claude Code, in an afternoon, by Andy Rosic, for the
Vercel Product Strategy & Operations conversation.

> All data is **illustrative / synthetic**. The point is the framework, not
> fake precision.

## What's here

- **Who's actually deploying** - human vs agent deploy mix trending toward ~30%
  agent, Claude Code dominant.
- **Landing, rebuilt** - the metrics a human-adoption dashboard goes blind on,
  and the agent-native replacements (time-to-first-deploy, iterate-loop count,
  retry/success rate, downstream reuse).
- **Ask the framework** - an interactive panel that reasons over the synthetic
  dataset to answer ops questions like "Did feature-analytics-v2 land?" It runs
  locally (deterministic, free, safe to expose publicly). A live Claude model
  can be dropped in behind the same shape - see `lib/framework.ts`.
- **ShipOps rhythm strip** - a nod to the weekly launch cadence.

## Stack

Next.js 16 (App Router) - Tailwind v4 - lucide-react - deployed on Vercel.
Design tokens ported from a Google Stitch design system.

## Develop

```bash
pnpm install
pnpm dev
pnpm build
```

## Structure

```
app/
  layout.tsx        # fonts (Geist/Inter/JetBrains Mono), metadata
  page.tsx          # composes the sections
  globals.css       # Tailwind v4 @theme design tokens
components/          # nav, hero, deploy-stats, landing-rebuilt,
                     # ask-framework, rhythm-strip, footer, sparkline
lib/
  data.ts           # synthetic dataset
  framework.ts      # local reasoning for "Ask the framework"
```
