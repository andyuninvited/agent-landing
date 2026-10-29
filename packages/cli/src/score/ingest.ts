import { readFile } from "node:fs/promises";
import { extname } from "node:path";

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

const MAX_DATA_BYTES = 50_000_000;

// RFC 4180 CSV: quoted fields, escaped quotes, CRLF or LF, optional BOM.
export const parseCsvRecords = (text: string): string[][] => {
  const src = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') inQuotes = false;
      else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      record.push(field);
      records.push(record);
      field = "";
      record = [];
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
    } else field += ch;
    i += 1;
  }
  if (inQuotes) throw new Error("CSV has an unterminated quoted field");
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => !(r.length === 1 && r[0]!.trim() === ""));
};

export const coerceCell = (raw: string): Cell => {
  const v = raw.trim();
  if (v === "") return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  const n = Number(v.replace(/%$/, ""));
  return Number.isFinite(n) && /^[-+]?(\d|\.\d)/.test(v) ? n : v;
};

export const parseCsv = (text: string): Row[] => {
  const [header, ...body] = parseCsvRecords(text);
  if (!header) return [];
  const cols = header.map((h) => h.trim());
  return body.map((rec, idx) => {
    if (rec.length > cols.length) throw new Error(`CSV row ${idx + 2} has ${rec.length} fields, header has ${cols.length}`);
    return Object.fromEntries(cols.map((c, i) => [c, coerceCell(rec[i] ?? "")]));
  });
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toCell = (v: unknown): Cell =>
  v === null || v === undefined ? null : typeof v === "number" || typeof v === "boolean" ? v : typeof v === "string" ? coerceCell(v) : JSON.stringify(v);

export const parseJsonRows = (text: string): Row[] => {
  const data: unknown = JSON.parse(text);
  const list = Array.isArray(data) ? data : isPlainObject(data) && Array.isArray(data.events) ? data.events : null;
  if (!list) throw new Error('JSON data must be an array of objects or {"events": [...]}');
  return list.map((item, i) => {
    if (!isPlainObject(item)) throw new Error(`JSON event ${i} is not an object`);
    return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, toCell(v)]));
  });
};

export const parseData = (text: string, kind: "csv" | "json"): Row[] =>
  kind === "csv" ? parseCsv(text) : parseJsonRows(text);

export const loadData = async (path: string): Promise<Row[]> => {
  const buf = await readFile(path);
  if (buf.byteLength > MAX_DATA_BYTES) throw new Error(`Data file is over ${MAX_DATA_BYTES / 1_000_000} MB`);
  const ext = extname(path).toLowerCase();
  const kind = ext === ".csv" ? "csv" : ext === ".json" ? "json" : null;
  if (!kind) throw new Error(`Unsupported data file "${path}". Use .csv or .json`);
  return parseData(buf.toString("utf8"), kind);
};
