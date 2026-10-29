# Scoring method (agent-landing score)

The score command generalizes the demo site's Landing Scorecard (`lib/scoring.ts`). Everything below comes from `score` in `agent-landing.config.json`; nothing is hard-coded.

## 1. Ingest

Input is a `.csv` or `.json` file. JSON is an array of objects or `{"events": [...]}`. CSV follows RFC 4180 (quoted fields, escaped quotes, CRLF or LF, optional BOM). Cells become numbers when numeric (a trailing `%` is dropped), booleans for `true`/`false`, and empty cells are missing.

Two layouts:

- **wide** (default): one row per feature, one column per signal.
  ```csv
  feature,agent_integration,agent_retry,retry_rate_pct
  sdk-v4,90,94,2.4
  ```
  Columns default to the signal `key`. Map different names with `signalColumns`: `{ "agent_integration": "Agent Integration %" }`.
- **long**: one row per feature, signal, and value. Good for event exports.
  ```json
  [{ "feature": "sdk-v4", "signal": "ttfd_s", "value": 21 }]
  ```
  Rename the three columns with `columns`: `{ "feature": "launch", "signal": "metric", "value": "v" }`.

Repeated values for one feature and signal combine with `aggregate`: `mean` (default), `sum`, `min`, `max`, or `last`. Rows without a feature, non-numeric values, and signals not in the config are skipped and reported as warnings.

## 2. Normalize to health (0 to 100)

Each signal has a `normalize` rule:

- `identity`: the value already is 0 to 100 health (clamped).
- `linear`: `(raw - min) / (max - min) * 100`, clamped, and flipped when `direction` is `lower` (for retry rate, latency, time to first deploy).
- `boolean`: 100 when the value matches `good` (default `true`), else 0.

## 3. Lens score

For each lens, take its signals that have data and a weight above 0:

```
lens score = round( sum(health * weight) / sum(weight) )
```

This is the same weight-normalized average as `computeScore` in `lib/scoring.ts`. Signals with no data are left out of both sums and listed as `missing`. A lens with no scored data reports no score.

Weight 0 marks a signal as watch-only: it is shown and can alert, and it never moves the score. The default config uses this for the raw retry rate.

## 4. Verdict

Each lens uses its own `verdicts` ladder when set, else the shared `score.verdicts`. The highest step whose `min` the score reaches wins. Each step has a `label` and a `tone` (`landed`, `mixed`, `risk`, or `blind`).

Defaults: Landed at 70, Mixed signal at 45, At risk below. The human lens adds "Can't see it" below 30 with tone `blind`, because a near-zero human score on an agent-driven launch means the lens cannot see the adopter, not that the launch failed.

## 5. Headline across lenses

- Every lens landed: "Yes."
- Any lens at risk while another landed: "Not yet. It looks landed under X, but it is at risk under Y."
- Any lens at risk, none landed: "Not yet."
- Some landed, the rest blind: "Yes and no."
- Some landed, the rest mixed: "Mostly."
- Every lens blind: "Can't tell", which usually means the right users are not instrumented.

## 6. Alerts and explanation

A signal with `alert` trips when the raw (pre-normalization) value is `above` or `below` the threshold. The message template takes `{label}`, `{value}`, and `{threshold}`.

The explanation joins the headline, one sentence per lens (score, verdict, two strongest signals at 60 or above, two weakest below 60, missing signals), and the alerts.

## The example

`agent-landing score --example` runs the default config on `examples/launches.csv`, built from the demo site's synthetic `featureScoring` data and retry rates. A test asserts the CLI reproduces the site's scores and verdicts exactly:

| Feature | Human lens | Agent lens | Headline |
| --- | --- | --- | --- |
| feature-analytics-v2 | 7, Can't see it | 82, Landed | Yes and no |
| sdk-v4 | 51, Mixed signal | 88, Landed | Mostly |
| auth-refactor | 76, Landed | 35, At risk (retry spike alert) | Not yet |
