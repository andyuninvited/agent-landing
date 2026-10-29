import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isBlockedAddress, safeFetch, type FetchOptions } from "../src/scan/net.js";
import { serve } from "./helpers.js";

const opts = (over: Partial<FetchOptions> = {}): FetchOptions => ({
  userAgent: "agent-landing-test",
  timeoutMs: 2000,
  maxBytes: 100_000,
  allowPrivate: true,
  ...over,
});

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "not-an-ip"])(
    "blocks %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));
});

describe("safeFetch", () => {
  let site: Awaited<ReturnType<typeof serve>>;
  beforeAll(async () => {
    site = await serve({
      "/ok": { body: "hello", type: "text/plain" },
      "/big": { body: "x".repeat(50_000), type: "text/plain" },
      "/gz": { body: gzipSync("y".repeat(20_000)), type: "text/plain", headers: { "content-encoding": "gzip" } },
      "/slow": { body: "", hang: true },
      "/hop": { status: 302, body: "", headers: { location: "/ok" } },
      "/to-metadata": { status: 302, body: "", headers: { location: "http://169.254.169.254/latest/meta-data/" } },
      "/loop": { status: 302, body: "", headers: { location: "/loop" } },
    });
  });
  afterAll(() => {
    site.server.closeAllConnections();
    return site.close();
  });

  it("refuses loopback targets unless allowPrivate is set", async () => {
    const r = await safeFetch(`${site.url}/ok`, "*/*", opts({ allowPrivate: false }));
    expect(r.status).toBe(0);
    expect(r.error).toMatch(/private or reserved/);
  });

  it("refuses hostnames that resolve to loopback", async () => {
    const r = await safeFetch(`${site.url.replace("127.0.0.1", "localhost")}/ok`, "*/*", opts({ allowPrivate: false }));
    expect(r.error).toMatch(/private or reserved/);
  });

  it("refuses non-http protocols and embedded credentials", async () => {
    expect((await safeFetch("file:///etc/passwd", "*/*", opts())).error).toMatch(/Unsupported protocol/);
    expect((await safeFetch("http://u:p@example.com/", "*/*", opts())).error).toMatch(/credentials/);
  });

  it("fetches, sends the User-Agent, and follows redirects", async () => {
    const r = await safeFetch(`${site.url}/hop`, "text/plain", opts());
    expect(r.status).toBe(200);
    expect(r.body).toBe("hello");
    expect(r.finalUrl).toBe(`${site.url}/ok`);
  });

  it("checks every redirect hop against the private-address guard", async () => {
    // Only the fixture server's address is allowed; the guard still has to stop the hop.
    const r = await safeFetch(`${site.url}/to-metadata`, "*/*", opts({ allowPrivate: ["127.0.0.1"] }));
    expect(r.error).toMatch(/private or reserved/);
    expect(r.redirects).toEqual(["http://169.254.169.254/latest/meta-data/"]);
  });

  it("stops redirect loops", async () => {
    expect((await safeFetch(`${site.url}/loop`, "*/*", opts({ maxRedirects: 3 }))).error).toMatch(/Too many redirects/);
  });

  it("caps response size and flags truncation", async () => {
    const r = await safeFetch(`${site.url}/big`, "*/*", opts({ maxBytes: 10_000 }));
    expect(r.truncated).toBe(true);
    expect(r.bytes).toBe(10_000);
  });

  it("caps decompressed size too", async () => {
    const r = await safeFetch(`${site.url}/gz`, "*/*", opts({ maxBytes: 12_000 }));
    expect(r.truncated).toBe(true);
    expect(r.body).toBe("y".repeat(12_000));
    const full = await safeFetch(`${site.url}/gz`, "*/*", opts());
    expect(full.body.length).toBe(20_000);
  });

  it("times out", async () => {
    const r = await safeFetch(`${site.url}/slow`, "*/*", opts({ timeoutMs: 200 }));
    expect(r.error).toMatch(/Timed out/);
  });
});
