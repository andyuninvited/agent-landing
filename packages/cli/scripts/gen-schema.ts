import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jsonSchemaText } from "../src/schema.js";

const out = fileURLToPath(new URL("../schema/agent-landing.schema.json", import.meta.url));
writeFileSync(out, jsonSchemaText());
console.log(`Wrote ${out}`);
