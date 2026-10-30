import { describe, expect, it } from "vitest";
import { features } from "../data";
import { apiCatalog, ask, homeMarkdown, llmsFullTxt, llmsTxt, openApiSpec } from "./content";
import { handleRpc, mcpManifest, TOOLS } from "./mcp";

describe("agent surfaces", () => {
  it("label the data synthetic and avoid em-dashes", () => {
    const all = [homeMarkdown(), llmsTxt(), llmsFullTxt(), JSON.stringify(mcpManifest()), JSON.stringify(openApiSpec())].join("\n");
    expect(homeMarkdown()).toMatch(/synthetic/i);
    expect(all).not.toContain("—");
  });
  it("llms.txt has an H1, a summary, and the agent endpoints", () => {
    expect(llmsTxt().startsWith("# The Agent-as-User Landing Framework\n\n> ")).toBe(true);
    ["/index.md", "/llms-full.txt", "/openapi.json", "/mcp"].forEach((p) => expect(llmsTxt()).toContain(p));
  });
  it("full text covers every launch", () => {
    features.forEach((f) => expect(llmsFullTxt()).toContain(`### ${f.name}`));
  });
  it("OpenAPI paths are read-only and the catalog points at the spec", () => {
    Object.values(openApiSpec().paths).forEach((ops) => expect(Object.keys(ops)).toEqual(["get"]));
    expect(apiCatalog().linkset[0]["service-desc"][0].href).toMatch(/\/openapi\.json$/);
  });
  it("ask is deterministic and marked synthetic", () => {
    expect(ask("Did sdk-v4 land successfully?")).toEqual(ask("Did sdk-v4 land successfully?"));
    expect(ask("Did sdk-v4 land successfully?").synthetic).toBe(true);
  });
});

describe("MCP", () => {
  const call = (method: string, params?: unknown) => handleRpc({ jsonrpc: "2.0", id: 1, method, params });

  it("initializes and lists read-only tools", () => {
    expect(call("initialize", { protocolVersion: "2025-06-18" })?.result).toMatchObject({ protocolVersion: "2025-06-18" });
    const tools = (call("tools/list")?.result as { tools: { name: string; annotations: { readOnlyHint: boolean } }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    tools.forEach((t) => expect(t.annotations.readOnlyHint).toBe(true));
  });
  it("answers ask_framework and rejects bad input", () => {
    const r = call("tools/call", { name: "ask_framework", arguments: { question: "Did auth-refactor land successfully?" } })?.result as { isError: boolean; content: { text: string }[] };
    expect(r.isError).toBe(false);
    expect(JSON.parse(r.content[0].text).answer).toMatch(/Retry rate spiked/);
    expect(call("tools/call", { name: "ask_framework", arguments: { question: "x".repeat(501) } })?.result).toMatchObject({ isError: true });
    expect(call("tools/call", { name: "get_launch", arguments: { id: "nope" } })?.result).toMatchObject({ isError: true });
  });
  it("rejects unknown tools, methods, and malformed messages", () => {
    expect(call("tools/call", { name: "rm_rf" })?.error?.code).toBe(-32602);
    expect(call("resources/list")?.error?.code).toBe(-32601);
    expect(handleRpc([])?.error?.code).toBe(-32600);
    expect(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });
});
