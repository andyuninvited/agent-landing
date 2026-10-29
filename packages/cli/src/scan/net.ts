import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import type { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const blocked = new BlockList();
(
  [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ] as const
).forEach(([net, prefix]) => blocked.addSubnet(net, prefix, "ipv4"));
(
  [
    ["::", 128],
    ["::1", 128],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
    ["2001:db8::", 32],
    ["100::", 64],
  ] as const
).forEach(([net, prefix]) => blocked.addSubnet(net, prefix, "ipv6"));

// IPv4 embedded in IPv6 (mapped ::ffff:a.b.c.d, NAT64 64:ff9b::/96), in dotted or hex form.
const embeddedIpv4 = (ip: string): string | null => {
  const m = /^(?:::ffff:|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(ip);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2]!, 16);
  const lo = parseInt(m[3]!, 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
};

export const isBlockedAddress = (address: string): boolean => {
  const ip = address.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const family = isIP(ip);
  if (family === 0) return true;
  if (family === 4) return blocked.check(ip, "ipv4");
  const v4 = embeddedIpv4(ip);
  return v4 ? blocked.check(v4, "ipv4") : blocked.check(ip, "ipv6");
};

// true allows every private address (local testing); a list allows only those exact IPs.
export type PrivateAllowance = boolean | string[];

const permitted = (address: string, allow: PrivateAllowance): boolean =>
  allow === true || (Array.isArray(allow) && allow.includes(address)) || !isBlockedAddress(address);

export class BlockedAddressError extends Error {
  readonly code = "EBLOCKED";
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

// Validates every resolved address at connect time, so DNS rebinding cannot slip a private IP past a pre-check.
export const guardedLookup =
  (allowPrivate: PrivateAllowance) =>
  (hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, []);
      const bad = addresses.find((a) => !permitted(a.address, allowPrivate));
      if (bad)
        return callback(new BlockedAddressError(`Refusing to connect to private or reserved address ${bad.address} for ${hostname}`), []);
      if (options.all) return callback(null, addresses);
      const first = addresses[0];
      if (!first) return callback(new Error(`No address for ${hostname}`), []);
      callback(null, first.address, first.family);
    });
  };

export type FetchOptions = {
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
  allowPrivate: PrivateAllowance;
  maxRedirects?: number;
};

export type FetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  truncated: boolean;
  redirects: string[];
  error?: string;
};

const errorResult = (url: string, error: string, redirects: string[] = []): FetchResult => ({
  url,
  finalUrl: redirects[redirects.length - 1] ?? url,
  status: 0,
  headers: {},
  body: "",
  bytes: 0,
  truncated: false,
  redirects,
  error,
});

export const assertFetchable = (target: URL, allowPrivate: PrivateAllowance): void => {
  if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error(`Unsupported protocol ${target.protocol}`);
  if (target.username || target.password) throw new Error("URLs with credentials are not allowed");
  const host = target.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && !permitted(host, allowPrivate))
    throw new BlockedAddressError(`Refusing to fetch private or reserved address ${host}`);
};

const flatHeaders = (h: http.IncomingHttpHeaders): Record<string, string> =>
  Object.fromEntries(
    Object.entries(h).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(", ") : v]])),
  );

const decoderFor = (encoding: string | undefined, res: Readable): Readable => {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return res.pipe(createGunzip());
    case "deflate":
      return res.pipe(createInflate());
    case "br":
      return res.pipe(createBrotliDecompress());
    default:
      return res;
  }
};

type Hop = { status: number; headers: Record<string, string>; body: string; bytes: number; truncated: boolean };

const requestOnce = (target: URL, accept: string, opts: FetchOptions): Promise<Hop> =>
  new Promise((resolve, reject) => {
    const mod = target.protocol === "https:" ? https : http;
    const req = mod.request(
      target,
      {
        method: "GET",
        headers: { "user-agent": opts.userAgent, accept, "accept-encoding": "gzip, deflate, br" },
        lookup: guardedLookup(opts.allowPrivate),
        timeout: opts.timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = flatHeaders(res.headers);
        if (status >= 300 && status < 400 && headers.location) {
          res.resume();
          return resolve({ status, headers, body: "", bytes: 0, truncated: false });
        }
        const stream = decoderFor(headers["content-encoding"], res);
        const chunks: Buffer[] = [];
        let bytes = 0;
        let truncated = false;
        stream.on("data", (chunk: Buffer) => {
          if (truncated) return;
          const room = opts.maxBytes - bytes;
          if (chunk.length > room) {
            chunks.push(chunk.subarray(0, room));
            bytes += room;
            truncated = true;
            req.destroy();
            resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8"), bytes, truncated });
            return;
          }
          chunks.push(chunk);
          bytes += chunk.length;
        });
        stream.on("end", () => resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8"), bytes, truncated }));
        stream.on("error", (e) => (truncated ? undefined : reject(e)));
      },
    );
    const timer = setTimeout(() => req.destroy(new Error(`Timed out after ${opts.timeoutMs} ms`)), opts.timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new Error(`Timed out after ${opts.timeoutMs} ms`)));
    req.on("error", reject);
    req.end();
  });

export const safeFetch = async (url: string, accept: string, opts: FetchOptions): Promise<FetchResult> => {
  const maxRedirects = opts.maxRedirects ?? 5;
  const redirects: string[] = [];
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return errorResult(url, `Invalid URL ${url}`);
  }
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    try {
      assertFetchable(current, opts.allowPrivate);
      const res = await requestOnce(current, accept, opts);
      const location = res.headers.location;
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current);
        redirects.push(current.toString());
        continue;
      }
      return { url, finalUrl: current.toString(), redirects, ...res };
    } catch (e) {
      return errorResult(url, (e as Error).message, redirects);
    }
  }
  return errorResult(url, `Too many redirects (over ${maxRedirects})`, redirects);
};
