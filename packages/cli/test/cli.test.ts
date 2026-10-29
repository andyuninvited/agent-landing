import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { parseConfig } from "../src/config.js";

let out = "";
let err = "";
beforeEach(() => {
  out = "";
  err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((s) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s) => ((err += String(s)), true));
});
afterEach(() => vi.restoreAllMocks());

describe("cli", () => {
  it("prints help", async () => {
    expect(await main(["--help"])).toBe(0);
    expect(out).toMatch(/agent-landing scan <url>/);
  });

  it("scores the example as JSON", async () => {
    expect(await main(["score", "--example", "--json"])).toBe(0);
    const report = JSON.parse(out) as { features: { feature: string; headline: string }[] };
    expect(report.features.map((f) => f.feature)).toEqual(["feature-analytics-v2", "sdk-v4", "auth-refactor"]);
  });

  it("renders the example as markdown and terminal text", async () => {
    await main(["score", "--example", "--md"]);
    expect(out).toMatch(/^# Landing scorecard/);
    expect(out).toMatch(/\| auth-refactor \| 76 Landed \| 35 At risk \|/);
    out = "";
    await main(["score", "--example"]);
    expect(out).toMatch(/Retry rate spiked to 11.7%/);
    expect(out).not.toContain("\u001b[");
  });

  it("writes a valid config with init and refuses to overwrite it", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "al-cli-")), "agent-landing.config.json");
    expect(await main(["init", "--out", path])).toBe(0);
    expect(() => parseConfig(JSON.parse(readFileSync(path, "utf8")))).not.toThrow();
    expect(await main(["init", "--out", path])).toBe(2);
    expect(err).toMatch(/already exists/);
    expect(await main(["init", "--out", path, "--force"])).toBe(0);
  });

  it("reports usage errors with exit code 2", async () => {
    expect(await main(["scan"])).toBe(2);
    expect(await main(["score"])).toBe(2);
    expect(await main(["score", "--example", "--json", "--md"])).toBe(2);
    expect(await main(["scan", "https://example.com", "--pages", "docs"])).toBe(2);
    expect(await main(["bogus"])).toBe(2);
    expect(await main(["score", "--nope"])).toBe(2);
  });

  it("reports a bad config with exit code 1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "al-cli-"));
    expect(await main(["score", "--data", join(dir, "x.csv"), "--config", join(dir, "missing.json")])).toBe(1);
    expect(err).toMatch(/Config not found/);
  });
});
