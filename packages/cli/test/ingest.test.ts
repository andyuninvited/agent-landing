import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coerceCell, loadData, parseCsv, parseCsvRecords, parseJsonRows } from "../src/score/ingest.js";

describe("CSV ingest", () => {
  it("handles quotes, escaped quotes, commas, CRLF, and a BOM", () => {
    const text = '\uFEFFfeature,note,value\r\n"a,b","say ""hi""",3\r\nc,"multi\nline",4\r\n';
    expect(parseCsvRecords(text)).toEqual([
      ["feature", "note", "value"],
      ["a,b", 'say "hi"', "3"],
      ["c", "multi\nline", "4"],
    ]);
  });

  it("coerces numbers, percents, booleans, and blanks", () => {
    expect(coerceCell("42")).toBe(42);
    expect(coerceCell("3.1%")).toBe(3.1);
    expect(coerceCell("-0.5")).toBe(-0.5);
    expect(coerceCell("TRUE")).toBe(true);
    expect(coerceCell("")).toBeNull();
    expect(coerceCell("sdk-v4")).toBe("sdk-v4");
    expect(coerceCell("v2")).toBe("v2");
  });

  it("maps rows to header names and skips blank lines", () => {
    expect(parseCsv("feature,x\nf1,1\n\nf2,\n")).toEqual([
      { feature: "f1", x: 1 },
      { feature: "f2", x: null },
    ]);
  });

  it("rejects rows wider than the header and unterminated quotes", () => {
    expect(() => parseCsv("a,b\n1,2,3\n")).toThrow("row 2");
    expect(() => parseCsvRecords('a\n"open')).toThrow("unterminated");
  });
});

describe("JSON ingest", () => {
  it("accepts an array or an {events} wrapper", () => {
    expect(parseJsonRows('[{"feature":"f","v":1}]')).toEqual([{ feature: "f", v: 1 }]);
    expect(parseJsonRows('{"events":[{"feature":"f","ok":true,"v":"2"}]}')).toEqual([{ feature: "f", ok: true, v: 2 }]);
  });

  it("rejects other shapes", () => {
    expect(() => parseJsonRows('{"rows":[]}')).toThrow("array of objects");
    expect(() => parseJsonRows("[1]")).toThrow("not an object");
  });

  it("loads by file extension and refuses unknown types", async () => {
    const dir = mkdtempSync(join(tmpdir(), "al-ingest-"));
    writeFileSync(join(dir, "e.csv"), "feature,x\nf,1\n");
    writeFileSync(join(dir, "e.json"), '[{"feature":"f","x":1}]');
    writeFileSync(join(dir, "e.txt"), "x");
    expect(await loadData(join(dir, "e.csv"))).toEqual([{ feature: "f", x: 1 }]);
    expect(await loadData(join(dir, "e.json"))).toEqual([{ feature: "f", x: 1 }]);
    await expect(loadData(join(dir, "e.txt"))).rejects.toThrow("Unsupported");
  });
});
