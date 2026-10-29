# Scan check catalog

Every check scores 0 to 100, or is skipped (no score) when it could not run. Status: pass at 80 and above, warn at 50 to 79, fail below 50. The overall score is the weight-normalized average of the scored checks. Fixes are sorted by potential gain: `(100 - score) * weight / total weight of scored checks`.

Default weights are in parentheses. Override them in `scan.checks.<id>.weight`.

## robots-ai (15)

Reads `/robots.txt` and evaluates each agent in `scan.agentUserAgents` against each key page, using RFC 9309 matching (named group over `*`, longest rule wins, allow wins ties, `*` and `$` supported).

- Score: share of agent and page pairs allowed times 80, plus 10 if any AI agent is named explicitly, plus 10 for a `Sitemap:` line.
- No robots.txt (4xx, or an HTML fallback page): 70. Agents are allowed by default but there is no explicit policy.
- robots.txt returning 5xx: 20. RFC 9309 says crawlers treat that as disallow-all.
- Fix calls out blocked user-triggered agents (Claude-User, ChatGPT-User, Perplexity-User) first, because they fetch on behalf of a person asking about the product.

## llms-txt (15)

Fetches `/llms.txt` and `/llms-full.txt`. A 200 that serves HTML (an SPA fallback) does not count.

- llms.txt present: 50, plus 10 for an H1 title, 10 for a `>` summary line, 15 for three or more markdown links (8 for one or two), and 15 for llms-full.txt.
- Only llms-full.txt: 40. Neither: 0.

## sitemap (5)

Uses the first `Sitemap:` from robots.txt, else `/sitemap.xml`.

- Valid `urlset` or `sitemapindex`: 70, plus 15 when robots.txt references it, plus 15 when every key page is listed (always granted for a sitemap index).
- Valid XML with no `<loc>`: 40. Missing or invalid: 0.

## ssr-readable (15)

Per key page, strips scripts, styles, templates, SVG, and comments, then counts visible words, as an agent that does not run JavaScript would see the page.

- 150+ words: 70. 50 to 149: 45. Under 50: 10. Plus 10 each for a `<title>`, meta description, and non-empty `<h1>`. Minus 10 for an empty JS mount point (`#root`, `#__next`, `#app`) on a thin page.
- A page that fails to load scores 0. Pages skipped by robots.txt are left out.

## markdown (10)

Per key page, tries the page with `Accept: text/markdown` and the `.md` variant (`/docs` to `/docs.md`, `/` to `/index.md`), and looks for `<link rel="alternate" type="text/markdown">`.

- Served and advertised: 100. Served only: 85. Advertised only: 50. Neither: 0.

## structured-data (5)

Per key page, parses every `application/ld+json` block as JSON (never executed) and collects `@type` values, including inside `@graph`.

- Valid JSON-LD with a type: 100, minus 20 per block that fails to parse. OpenGraph only: 40. Nothing: 0.

## api-docs (10)

Probes `/openapi.json`, `/openapi.yaml`, `/swagger.json`, `/api/openapi.json`, and `/.well-known/api-catalog` (RFC 9727), and scans key page links plus llms.txt links.

- Spec plus api-catalog: 100. Spec: 95. api-catalog only: 90. Linked spec URL: 80. Linked API docs only: 50. Nothing: 0.
- Disable it for products without an API.

## mcp (10)

Probes `/.well-known/mcp.json`, `/.well-known/mcp`, and `/.well-known/mcp/server-card.json` for a JSON document, then scans key pages and llms.txt for MCP mentions and endpoint URLs (`https://mcp.*` or paths ending in `/mcp` or `/sse`).

- Discovery document: 100. Documented endpoint with a mention: 75, without: 65. Mention only: 45. Nothing: 0.
- Well-known MCP discovery is still a draft proposal, so the fix also asks for the endpoint in llms.txt and docs.

## auth-friction (10)

Per key page, starts at 100 and subtracts: redirect to a login path (60), HTTP 401 or 403 (60), HTTP 429 (40), bot challenge page such as Cloudflare, PerimeterX, Incapsula, or DataDome (70), CAPTCHA widget (25), and a password field (15). Floors at 0.

## page-weight (5)

Per key page, estimates tokens as characters divided by four, using the markdown version when one exists.

- Up to 8k tokens: 100. 20k: 85. 50k: 65. 100k: 40. 200k: 20. More, or over the `maxBytes` cap: 5.

## Fetching rules

- User-Agent from `scan.userAgent`. robots.txt is read first and the scanner obeys it for its own requests under the `agent-landing` token (falling back to `*`).
- Per-request timeout (`timeoutMs`), size cap after decompression (`maxBytes`), page cap (`maxPages`), and request cap (`maxRequests`). Up to 5 redirects per request.
- Every connection is checked at DNS resolution time, including redirect hops, and refused for loopback, private, link-local, CGNAT, multicast, and reserved ranges (IPv4 and IPv6, including IPv4-mapped forms). `--allow-private` lifts this for local testing only.
- Only http and https; URLs with embedded credentials are refused.
- Fetched content is parsed as text and JSON. Nothing fetched is executed.
