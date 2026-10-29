import { z } from "zod";
import { configSchema, SCHEMA_URL } from "./config.js";

export const jsonSchemaText = (): string => {
  const schema = z.toJSONSchema(configSchema, { io: "input", unrepresentable: "any" });
  return `${JSON.stringify({ ...schema, $id: SCHEMA_URL, title: "agent-landing config" }, null, 2)}\n`;
};
