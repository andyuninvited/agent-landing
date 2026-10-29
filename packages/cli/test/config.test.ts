import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkWeight, configSchema, defaultConfigFile, parseConfig } from "../src/config.js";
import { jsonSchemaText } from "../src/schema.js";

const baseScore = {
  lenses: [{ id: "agent", label: "Agent" }],
  signals: [{ key: "a", label: "A", lens: "agent", weight: 1 }],
};

describe("config", () => {
  it("fills every default from an empty object", () => {
    const cfg = parseConfig({});
    expect(cfg.scan.keyPages).toEqual(["/"]);
    expect(cfg.scan.maxRequests).toBe(40);
    expect(cfg.score.lenses.map((l) => l.id)).toEqual(["human", "agent"]);
    expect(checkWeight(cfg.scan, "llms-txt")).toBe(15);
  });

  it("accepts the file init writes", () => {
    const cfg = parseConfig(defaultConfigFile());
    expect(cfg.scan.keyPages).toEqual(["/", "/docs", "/pricing"]);
    expect(cfg.score.signals.find((s) => s.key === "retry_rate_pct")?.alert?.value).toBe(8);
  });

  it("lets a check weight and enabled flag be overridden", () => {
    const cfg = parseConfig({ scan: { checks: { mcp: { enabled: false }, sitemap: { weight: 40 } } } });
    expect(cfg.scan.checks.mcp?.enabled).toBe(false);
    expect(checkWeight(cfg.scan, "sitemap")).toBe(40);
  });

  it.each([
    [{ scan: { keyPages: ["docs"] } }, "must start with /"],
    [{ scan: { checks: { nope: {} } } }, "nope"],
    [{ scan: { maxPages: 500 } }, "maxPages"],
    [{ score: { ...baseScore, signals: [{ key: "a", label: "A", lens: "ghost", weight: 1 }] } }, 'unknown lens "ghost"'],
    [{ score: { ...baseScore, signals: [...baseScore.signals, ...baseScore.signals] } }, "unique"],
    [{ score: { ...baseScore, verdicts: [{ min: 50, label: "x", tone: "landed" }] } }, "min 0"],
    [{ score: { ...baseScore, signals: [{ key: "a", label: "A", lens: "agent", weight: 1, normalize: { type: "linear", min: 1, max: 1 } }] } }, "max different"],
    [{ extra: true }, "extra"],
  ])("rejects invalid config %#", (raw, message) => {
    expect(() => parseConfig(raw)).toThrow(message);
  });

  it("supports a custom partner lens", () => {
    const cfg = parseConfig({
      score: {
        lenses: [{ id: "partner", label: "Partner lens", verdicts: [{ min: 60, label: "Shipped", tone: "landed" }, { min: 0, label: "Stalled", tone: "risk" }] }],
        signals: [{ key: "partner_installs", label: "Partner installs", lens: "partner", weight: 1, normalize: { type: "linear", min: 0, max: 200 } }],
      },
    });
    expect(cfg.score.lenses[0]?.verdicts?.[0]?.label).toBe("Shipped");
  });

  it("keeps the committed JSON Schema in sync with the zod schema", () => {
    const committed = readFileSync(new URL("../schema/agent-landing.schema.json", import.meta.url), "utf8");
    expect(committed).toBe(jsonSchemaText());
    expect(configSchema).toBeDefined();
  });
});
