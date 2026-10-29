import { fileURLToPath } from "node:url";

// Synthetic launches derived from lib/data.ts (featureScoring + retry rates). Illustrative only.
export const examplePath = (): string => fileURLToPath(new URL("../examples/launches.csv", import.meta.url));
