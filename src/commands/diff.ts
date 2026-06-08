import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, toEnvMap, extractAnnotations, validateAndResolveFile } from "../lib/parser.js";
import { formatDiffResult, outputJson, outputText, type DiffEntry, type OutputOptions } from "../lib/output.js";

export interface DiffOptions extends OutputOptions {}

export function runDiff(envPath: string, examplePath: string, options: DiffOptions = { json: false }): DiffEntry[] {
  const envParsed = parseEnvFile(envPath);
  const exampleFullPath = validateAndResolveFile(examplePath);

  let exampleContent: string;
  try {
    exampleContent = readFileSync(exampleFullPath, "utf-8");
  } catch {
    throw new Error(`Example file not found: ${exampleFullPath}`);
  }

  const envMap = toEnvMap(envParsed);
  const annotations = extractAnnotations(exampleContent);
  const entries: DiffEntry[] = [];

  const allKeys = new Set([...annotations.keys(), ...envMap.keys()]);

  for (const key of allKeys) {
    const inEnv = envMap.has(key);
    const inExample = annotations.has(key);
    const envValue = envMap.get(key);

    if (inEnv && inExample) {
      if (!envValue || envValue === "") {
        entries.push({ key, status: "empty", envValue, exampleValue: annotations.get(key)?.defaultValue });
      } else {
        entries.push({ key, status: "present", envValue, exampleValue: annotations.get(key)?.defaultValue });
      }
    } else if (!inEnv && inExample) {
      entries.push({ key, status: "missing", exampleValue: annotations.get(key)?.defaultValue });
    } else {
      entries.push({ key, status: "extra", envValue });
    }
  }

  if (options.json) {
    outputJson(entries);
  } else {
    outputText(formatDiffResult(entries));
  }

  return entries;
}
