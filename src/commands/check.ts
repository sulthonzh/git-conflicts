import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, toEnvMap, extractAnnotations, validateFilePath } from "../lib/parser.js";
import { formatCheckResult, outputJson, outputText, type CheckResult, type OutputOptions } from "../lib/output.js";

export interface CheckOptions extends OutputOptions {}

export function runCheck(envPath: string, examplePath: string, options: CheckOptions = { json: false }): CheckResult {
  const envParsed = parseEnvFile(envPath);
  const exampleValidated = validateFilePath(examplePath);
  const exampleFullPath = resolve(exampleValidated);

  let exampleContent: string;
  try {
    exampleContent = readFileSync(exampleFullPath, "utf-8");
  } catch {
    throw new Error(`Example file not found: ${exampleFullPath}`);
  }

  const envMap = toEnvMap(envParsed);
  const annotations = extractAnnotations(exampleContent);

  const missing: string[] = [];
  const extra: string[] = [];
  const empty: string[] = [];

  for (const key of annotations.keys()) {
    if (!envMap.has(key)) {
      missing.push(key);
    } else if (envMap.get(key) === "" && annotations.get(key)?.required) {
      empty.push(key);
    }
  }

  for (const key of envMap.keys()) {
    if (!annotations.has(key)) {
      extra.push(key);
    }
  }

  const result: CheckResult = {
    missing,
    extra,
    empty,
    clean: missing.length === 0 && extra.length === 0 && empty.length === 0,
  };

  if (options.json) {
    outputJson(result);
  } else {
    outputText(formatCheckResult(result));
  }

  return result;
}
