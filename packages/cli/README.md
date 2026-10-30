# agent-landing

**Can an AI agent actually use your product? And did your last launch land with the agents, or only with the people?**

`agent-landing` is a CLI and Claude Code skill that answers both.

```bash
npx agent-landing scan https://your-product.com     # what an agent sees, with fixes ranked by points
npx agent-landing init                              # write agent-landing.config.json
npx agent-landing score --data launches.csv         # did each launch land, per audience
npx agent-landing score --example                   # try it on synthetic data
```

`scan` checks robots.txt rules for AI agents, llms.txt, sitemaps, server-rendered HTML, markdown versions, JSON-LD, API specs, MCP discovery, auth friction, and page weight. `score` reads your own launch data and gives a verdict for each lens you define, such as human, agent, or partner.

No LLM calls and no paid APIs. The scanner respects robots.txt, caps page sizes, and won't fetch private network addresses unless you pass `--allow-private`.

Full docs, the config reference, and the Claude Code plugin: [github.com/andyuninvited/agent-landing](https://github.com/andyuninvited/agent-landing)

MIT. Copyright (c) 2026 Andy Rosic.
