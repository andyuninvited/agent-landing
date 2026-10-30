import { askFramework, suggestedQuestions } from "../framework";
import { features, type FeatureRecord } from "../data";

export const SITE = {
  name: "The Agent-as-User Landing Framework",
  url: "https://agent-landing-rosic.vercel.app",
  repo: "https://github.com/andyuninvited/agent-landing",
  npm: "https://www.npmjs.com/package/agent-landing",
  author: "Andy Rosic",
  email: "me@andyrosic.com",
  summary:
    "A working prototype of product-landing measurement for the agent era. It scores whether a launch landed with human users, agent users, or both, from the same telemetry. All data on this site is synthetic.",
} as const;

export const SYNTHETIC = "All data here is synthetic and illustrative.";
export const INSTALL = ["npx agent-landing scan https://your-product.com", "/plugin install agent-landing --marketplace andyuninvited/agent-landing"] as const;

const abs = (path: string) => `${SITE.url}${path}`;

export const featureJson = (f: FeatureRecord) => ({ ...f, synthetic: true, ask: abs(`/api/v1/ask?q=${encodeURIComponent(`Did ${f.name} land successfully?`)}`) });
export const featuresJson = () => features.map(featureJson);
export const featureById = (id: string) => features.find((f) => f.id === id);
export const ask = (q: string) => ({ ...askFramework(q), synthetic: true });
export const installJson = () => ({ cli: INSTALL[0], claudeCode: INSTALL[1], repo: SITE.repo, npm: SITE.npm });

const featureLine = (f: FeatureRecord) =>
  `- **${f.name}** (${f.verdict}): human adoption ${f.humanAdoption}, ${f.agentIntegrationPct}% of agent sessions integrated it within ${f.windowMins} minutes, retry rate ${f.retryRatePct}%${f.retrySpike ? " (spike)" : ""}, downstream reuse ${f.downstreamReuse}.`;

export const homeMarkdown = () =>
  [
    `# ${SITE.name}`,
    "",
    `> ${SITE.summary}`,
    "",
    "Agents now account for a large share of deploys on developer platforms. A human-adoption dashboard goes blind to that user, so the landing measurement has to judge each launch under two lenses: did people adopt it, and did agents integrate it without retrying until they gave up.",
    "",
    `## Example launches (${SYNTHETIC.toLowerCase().replace(/\.$/, "")})`,
    "",
    ...features.map(featureLine),
    "",
    "## Ask the framework",
    "",
    ...suggestedQuestions.map((q) => `- ${q}`),
    "",
    `Ask any of these through the API (${abs("/api/v1/ask")}) or the MCP server (${abs("/mcp")}).`,
    "",
    "## Use it on your own product",
    "",
    `- CLI: \`${INSTALL[0]}\``,
    `- Claude Code: \`${INSTALL[1]}\``,
    `- Source: ${SITE.repo}`,
    "",
    `Made by ${SITE.author} (${SITE.email}).`,
    "",
  ].join("\n");

export const llmsTxt = () =>
  [
    `# ${SITE.name}`,
    "",
    `> ${SITE.summary}`,
    "",
    "## Pages",
    "",
    `- [Home as markdown](${abs("/index.md")}): the framework, the example launches, and how to use it`,
    `- [Source and docs](${SITE.repo}): README, CLI reference, config schema, and scoring method`,
    `- [Check catalog](${SITE.repo}/blob/main/skills/agent-landing/references/check-catalog.md): how every scan check is scored`,
    `- [npm package](${SITE.npm}): the agent-landing CLI`,
    "",
    "## For agents",
    "",
    `- [Full content](${abs("/llms-full.txt")}): everything on the site in one file`,
    `- [OpenAPI spec](${abs("/openapi.json")}): read-only JSON API for the example launches and the Ask endpoint`,
    `- [MCP server](${abs("/mcp")}): read-only MCP server, Streamable HTTP transport, no auth. Tools: list_launches, get_launch, ask_framework, get_install`,
    "",
  ].join("\n");

export const llmsFullTxt = () =>
  [homeMarkdown(), "## Verdicts for each example launch", "", ...features.map((f) => `### ${f.name}\n\n${askFramework(`Did ${f.name} land successfully?`).answer}\n`)].join("\n");

const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", properties, required });
const str = { type: "string" };
const num = { type: "number" };
const feature = obj(
  { id: str, name: str, deployedAt: str, humanAdoption: str, agentIntegrationPct: num, windowMins: num, retrySpike: { type: "boolean" }, retryRatePct: num, downstreamReuse: str, verdict: str, synthetic: { type: "boolean" }, ask: str },
  ["id", "name", "verdict"],
);
const verdict = obj({ question: str, answer: str, source: str, tone: str, synthetic: { type: "boolean" } }, ["question", "answer"]);
const ok = (description: string, schema: unknown) => ({ "200": { description, content: { "application/json": { schema } } } });

export const openApiSpec = () => ({
  openapi: "3.1.0",
  info: { title: `${SITE.name} demo API`, version: "1.0.0", description: `Read-only API over the demo site's example launches. ${SYNTHETIC} No auth.` },
  servers: [{ url: SITE.url }],
  paths: {
    "/api/v1/launches": { get: { operationId: "listLaunches", summary: "List the example launches", responses: ok("Launches", { type: "array", items: feature }) } },
    "/api/v1/launches/{id}": {
      get: {
        operationId: "getLaunch",
        summary: "Get one example launch",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", enum: features.map((f) => f.id) } }],
        responses: { ...ok("Launch", feature), "404": { description: "No launch with that id" } },
      },
    },
    "/api/v1/ask": {
      get: {
        operationId: "askFramework",
        summary: "Ask the framework whether a launch landed",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", maxLength: 500 } }],
        responses: { ...ok("Verdict", verdict), "400": { description: "Missing or too-long question" } },
      },
    },
    "/api/v1/install": { get: { operationId: "getInstall", summary: "How to run agent-landing on your own product", responses: ok("Install", obj({ cli: str, claudeCode: str, repo: str, npm: str }, ["cli"])) } },
  },
});

export const apiCatalog = () => ({
  linkset: [{ anchor: abs("/api/v1"), "service-desc": [{ href: abs("/openapi.json"), type: "application/openapi+json" }], "service-doc": [{ href: abs("/llms.txt"), type: "text/markdown" }] }],
});

export const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" };
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: JSON_HEADERS });
export const MD_HEADERS = { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" };
