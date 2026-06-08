import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, toEnvMap, extractAnnotations, validateFilePath, validateAndResolveFile } from "../lib/parser.js";
import { formatCheckResult, outputJson, outputText, type CheckResult, type OutputOptions } from "../lib/output.js";

export interface CheckOptions extends OutputOptions {
  /** Strict mode: fail on extra keys and all empty values */
  strict?: boolean;
}

export function runCheck(envPath: string, examplePath: string, options: CheckOptions = { json: false }): CheckResult {
  const envParsed = parseEnvFile(envPath);
  const exampleFullPath = validateAndResolveFile(examplePath);

  let exampleContent: string;
  try {
    exampleContent = readFileSync(exampleFullPath, "utf-8");
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`Example file not found: ${exampleFullPath}`);
    }
    if (error.code === "EACCES") {
      throw new Error(`Permission denied reading example file: ${exampleFullPath}`);
    }
    throw new Error(`Failed to read example file ${exampleFullPath}: ${error.message}`);
  }

  const envMap = toEnvMap(envParsed);
  const annotations = extractAnnotations(exampleContent);

  const missing: string[] = [];
  const extra: string[] = [];
  const empty: string[] = [];

  for (const key of annotations.keys()) {
    if (!envMap.has(key)) {
      missing.push(key);
    } else if (envMap.get(key) === "" && (annotations.get(key)?.required || options.strict)) {
      empty.push(key);
    }
  }

  for (const key of envMap.keys()) {
    if (!annotations.has(key)) {
      if (options.strict) {
        // In strict mode, extra keys are treated as errors
        extra.push(key);
      }
    } else if (options.strict && envMap.get(key) === "") {
      // In strict mode, empty values are always errors
      empty.push(key);
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
